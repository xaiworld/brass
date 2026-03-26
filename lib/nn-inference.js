/**
 * Neural network inference for Brass: Lancashire bots.
 * Pure JavaScript — no external dependencies.
 * Loads weights from nn-weights.json and runs forward passes.
 */

const fs = require('fs');
const path = require('path');
const { locations, links, externalPortIds } = require('./board-data');
const { industries } = require('./industry-data');
const { getPlayerNetwork, getConnectedLocations } = require('./game-engine');

// ============ BOARD CONSTANTS (must match Python encoder) ============

const LOC_IDS = Object.keys(locations).sort();
const LOC_IDX = {};
LOC_IDS.forEach((id, i) => LOC_IDX[id] = i);
const LINK_IDS = links.map(l => l.id);
const LINK_IDX = {};
LINK_IDS.forEach((id, i) => LINK_IDX[id] = i);
const IND_TYPES = ['cottonMill', 'coalMine', 'ironWorks', 'port', 'shipyard'];
const MAX_SLOTS = 4;
const ACTION_TYPES = ['buildIndustry', 'buildLink', 'sellCotton', 'takeLoan', 'develop', 'pass'];

// Income track (matching Python)
const INCOME_TRACK = [];
for (let i = 0; i <= 9; i++) INCOME_TRACK.push(-10 + i);
INCOME_TRACK.push(0);
for (let inc = 1; inc <= 10; inc++) { INCOME_TRACK.push(inc); INCOME_TRACK.push(inc); }
for (let inc = 11; inc <= 20; inc++) { INCOME_TRACK.push(inc); INCOME_TRACK.push(inc); INCOME_TRACK.push(inc); }
for (let inc = 21; inc <= 29; inc++) { INCOME_TRACK.push(inc); INCOME_TRACK.push(inc); INCOME_TRACK.push(inc); INCOME_TRACK.push(inc); }
INCOME_TRACK.push(30); INCOME_TRACK.push(30); INCOME_TRACK.push(30);

// ============ TENSOR OPERATIONS ============

function relu(x) { return x > 0 ? x : 0; }
function sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x)))); }

function matmul(mat, vec) {
  // mat: [out_dim][in_dim], vec: [in_dim] -> [out_dim]
  const out = new Float32Array(mat.length);
  for (let i = 0; i < mat.length; i++) {
    let sum = 0;
    const row = mat[i];
    for (let j = 0; j < row.length; j++) {
      sum += row[j] * vec[j];
    }
    out[i] = sum;
  }
  return out;
}

function addBias(vec, bias) {
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] + bias[i];
  return out;
}

function applyRelu(vec) {
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = relu(vec[i]);
  return out;
}

function layerNorm(vec, weight, bias, eps = 1e-5) {
  const n = vec.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += vec[i];
  mean /= n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (vec[i] - mean) * (vec[i] - mean);
  variance /= n;
  const std = Math.sqrt(variance + eps);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = weight[i] * ((vec[i] - mean) / std) + bias[i];
  }
  return out;
}

function concat(a, b) {
  const out = new Float32Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

function softmax(vec) {
  let max = -Infinity;
  for (let i = 0; i < vec.length; i++) if (vec[i] > max) max = vec[i];
  const exp = new Float32Array(vec.length);
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    exp[i] = Math.exp(vec[i] - max);
    sum += exp[i];
  }
  for (let i = 0; i < vec.length; i++) exp[i] /= sum;
  return exp;
}

// ============ NETWORK ============

class BrassNetInference {
  constructor(weightsPath) {
    const data = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));
    this.stateSize = data.state_size;
    this.actionSize = data.action_size;
    this.w = {};
    for (const [k, v] of Object.entries(data.weights)) {
      if (Array.isArray(v[0])) {
        // 2D: convert to array of Float32Arrays
        this.w[k] = v.map(row => new Float32Array(row));
      } else {
        this.w[k] = new Float32Array(v);
      }
    }
    console.log('[NN] Loaded weights: state=' + this.stateSize + ' action=' + this.actionSize);
  }

  encodeState(hidden) {
    // input_proj: Linear(state, 512) + ReLU + LayerNorm
    let x = addBias(matmul(this.w['input_proj.0.weight'], hidden), this.w['input_proj.0.bias']);
    x = applyRelu(x);
    x = layerNorm(x, this.w['input_proj.2.weight'], this.w['input_proj.2.bias']);

    // 3 residual blocks
    for (let b = 0; b < 3; b++) {
      const prefix = 'res_blocks.' + b;
      const residual = x;
      x = addBias(matmul(this.w[prefix + '.fc1.weight'], x), this.w[prefix + '.fc1.bias']);
      x = applyRelu(x);
      x = addBias(matmul(this.w[prefix + '.fc2.weight'], x), this.w[prefix + '.fc2.bias']);
      // Add residual
      const added = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) added[i] = x[i] + residual[i];
      x = layerNorm(added, this.w[prefix + '.ln.weight'], this.w[prefix + '.ln.bias']);
      x = applyRelu(x);
    }
    return x;
  }

  getValue(stateHidden) {
    let x = addBias(matmul(this.w['value_head.0.weight'], stateHidden), this.w['value_head.0.bias']);
    x = applyRelu(x);
    x = addBias(matmul(this.w['value_head.2.weight'], x), this.w['value_head.2.bias']);
    x = applyRelu(x);
    x = addBias(matmul(this.w['value_head.4.weight'], x), this.w['value_head.4.bias']);
    return sigmoid(x[0]);
  }

  scoreAction(stateHidden, actionFeatures) {
    const combined = concat(stateHidden, actionFeatures);
    let x = addBias(matmul(this.w['action_net.0.weight'], combined), this.w['action_net.0.bias']);
    x = applyRelu(x);
    x = addBias(matmul(this.w['action_net.2.weight'], x), this.w['action_net.2.bias']);
    x = applyRelu(x);
    x = addBias(matmul(this.w['action_net.4.weight'], x), this.w['action_net.4.bias']);
    return x[0];
  }
}

// ============ STATE ENCODING (must match Python encode_state_v2) ============

function encodeGameState(state, perspectiveSeat) {
  const features = [];
  const numP = state.numPlayers || state.players.length;

  // Board slots: LOC_IDS × MAX_SLOTS × 11
  for (const locId of LOC_IDS) {
    const locState = state.board.locations[locId];
    const slots = locState ? locState.slots : [];
    for (let si = 0; si < MAX_SLOTS; si++) {
      if (si < slots.length) {
        const slot = slots[si];
        if (slot.owner === null || slot.owner === undefined) {
          features.push(1, 0, 0, 0);
        } else if (slot.owner === perspectiveSeat) {
          features.push(0, 1, 0, 0);
        } else {
          const opp = ((slot.owner - perspectiveSeat) % numP + numP) % numP;
          const oh = [0, 0, 0, 0];
          oh[Math.min(opp + 1, 3)] = 1;
          features.push(...oh);
        }
        for (const ind of IND_TYPES) features.push(slot.industryType === ind ? 1 : 0);
        features.push((slot.level || 0) / 4);
        features.push(slot.flipped ? 1 : 0);
      } else {
        for (let i = 0; i < 11; i++) features.push(0);
      }
    }
  }

  // Links
  for (const linkId of LINK_IDS) {
    const link = state.board.links[linkId];
    if (!link) { for (let i = 0; i < 6; i++) features.push(0); continue; }
    if (link.owner === null || link.owner === undefined) {
      features.push(1, 0, 0, 0);
    } else if (link.owner === perspectiveSeat) {
      features.push(0, 1, 0, 0);
    } else {
      const opp = ((link.owner - perspectiveSeat) % numP + numP) % numP;
      const oh = [0, 0, 0, 0];
      oh[Math.min(opp + 1, 3)] = 1;
      features.push(...oh);
    }
    features.push(link.type === null ? 0 : (link.type === 'canal' ? 0.5 : 1));
    const avail = state.era === 'canal' ? link.canal : link.rail;
    features.push(avail ? 1 : 0);
  }

  // Per player (perspective first)
  for (let offset = 0; offset < numP; offset++) {
    const seat = (perspectiveSeat + offset) % numP;
    const p = state.players[seat];
    features.push(p.money / 100);
    features.push(INCOME_TRACK[Math.min(p.income, 99)] / 30);
    features.push(p.income / 99);
    features.push(p.vp / 150);
    features.push((p.spentThisRound || 0) / 50);
    features.push(p.hand.length / 8);
    for (const ind of IND_TYPES) features.push((p.industryMat[ind] || []).length / 12);
    for (const ind of IND_TYPES) {
      const mat = p.industryMat[ind] || [];
      features.push(mat.length > 0 ? mat[0] / 4 : 0);
    }
    // Flipped tiles owned
    let flipped = 0, ufMills = 0, ownLinks = 0;
    for (const [, loc] of Object.entries(state.board.locations)) {
      for (const s of loc.slots) {
        if (s.owner === seat && s.flipped) flipped++;
        if (s.owner === seat && s.industryType === 'cottonMill' && !s.flipped) ufMills++;
      }
    }
    for (const l of Object.values(state.board.links)) if (l.owner === seat) ownLinks++;
    features.push(flipped / 20);
    features.push(ufMills / 10);
    features.push(ownLinks / 15);
  }
  for (let i = 0; i < (3 - numP) * 18; i++) features.push(0);

  // Markets
  features.push(state.coalMarket / 8);
  features.push(state.ironMarket / 8);
  features.push(state.distantMarketDemand / 8);
  features.push((state.distantMarketTiles || []).length / 11);

  // Game phase
  features.push(state.era === 'rail' ? 1 : 0);
  features.push((state.round || 1) / 10);
  features.push((state.drawPile || []).length / 50);
  features.push((state.actionsRemaining || 1) / 2);
  const curSeat = state.turnOrder[state.currentPlayerIndex];
  features.push(curSeat === perspectiveSeat ? 1 : 0);

  // Hand content
  const p = state.players[perspectiveSeat];
  const locCounts = {};
  const indCounts = {};
  for (const cardId of p.hand) {
    const info = getCardInfo(cardId);
    if (info.type === 'location') locCounts[info.value] = (locCounts[info.value] || 0) + 1;
    else indCounts[info.value] = (indCounts[info.value] || 0) + 1;
  }
  for (const locId of LOC_IDS) features.push((locCounts[locId] || 0) / 3);
  for (const ind of IND_TYPES) features.push((indCounts[ind] || 0) / 4);

  // Strategic situation
  const network = getPlayerNetwork(state, perspectiveSeat);
  let sellOpps = 0;
  for (const [locId, loc] of Object.entries(state.board.locations)) {
    for (const slot of loc.slots) {
      if (slot.owner === perspectiveSeat && slot.industryType === 'cottonMill' && !slot.flipped) {
        const connected = getConnectedLocations(state, locId);
        for (const c of connected) {
          if (externalPortIds && externalPortIds.includes(c)) { sellOpps++; break; }
          const cl = state.board.locations[c];
          if (cl) {
            let found = false;
            for (const s of cl.slots) {
              if (s.industryType === 'port' && s.owner !== null && !s.flipped) { found = true; break; }
            }
            if (found) { sellOpps++; break; }
          }
        }
      }
    }
  }
  features.push(sellOpps / 5);

  let portsInNet = 0;
  for (const locId of network) {
    if (externalPortIds && externalPortIds.includes(locId)) { portsInNet++; continue; }
    const loc = state.board.locations[locId];
    if (loc) {
      for (const s of loc.slots) {
        if (s.industryType === 'port' && s.owner !== null && !s.flipped) portsInNet++;
      }
    }
  }
  features.push(portsInNet / 5);
  features.push(network.size / 20);

  return new Float32Array(features);
}

function getCardInfo(cardId) {
  if (cardId.startsWith('cotton_')) return { type: 'industry', value: 'cottonMill' };
  if (cardId.startsWith('coal_')) return { type: 'industry', value: 'coalMine' };
  if (cardId.startsWith('iron_')) return { type: 'industry', value: 'ironWorks' };
  if (cardId.startsWith('port_')) return { type: 'industry', value: 'port' };
  if (cardId.startsWith('shipyard_')) return { type: 'industry', value: 'shipyard' };
  const parts = cardId.split('_');
  return { type: 'location', value: parts.slice(0, -1).join('_') };
}

// ============ ACTION ENCODING (must match Python encode_action_v2) ============

function encodeAction(state, player, action) {
  const features = [];
  const seat = player.seat;

  // Action type one-hot
  for (const at of ACTION_TYPES) features.push(action.type === at ? 1 : 0);

  // Player context
  features.push(player.money / 100);
  features.push(INCOME_TRACK[Math.min(player.income, 99)] / 30);
  features.push(player.vp / 150);
  features.push(player.hand.length / 8);
  features.push(state.era === 'rail' ? 1 : 0);

  // Build Industry
  if (action.type === 'buildIndustry') {
    const indType = action.industryType;
    const mat = player.industryMat[indType] || [];
    const level = mat.length > 0 ? mat[0] : 0;
    const tile = industries[indType]?.levels[level] || {};
    features.push((tile.vp || 0) / 18);
    features.push((tile.incomeGain || 0) / 7);
    features.push((tile.cost || 0) / 25);
    features.push(level / 4);
    for (const ind of IND_TYPES) features.push(indType === ind ? 1 : 0);
    // Connected to port?
    const connected = getConnectedLocations(state, action.location);
    let hasPort = false;
    for (const c of connected) {
      if (externalPortIds && externalPortIds.includes(c)) { hasPort = true; break; }
      const cl = state.board.locations[c];
      if (cl) {
        for (const s of cl.slots) {
          if (s.industryType === 'port' && s.owner !== null && !s.flipped) { hasPort = true; break; }
        }
      }
      if (hasPort) break;
    }
    features.push(hasPort ? 1 : 0);
    const network = getPlayerNetwork(state, seat);
    features.push(network.has(action.location) ? 1 : 0);
  } else {
    for (let i = 0; i < 11; i++) features.push(0);
  }

  // Build Link
  if (action.type === 'buildLink') {
    const link = state.board.links[action.linkId];
    if (link) {
      features.push((link.segments || 1) / 2);
      let epTiles = 0;
      for (const end of [link.from, link.to]) {
        const loc = state.board.locations[end];
        if (loc) for (const s of loc.slots) if (s.owner !== null) epTiles++;
      }
      features.push(epTiles / 8);
      let enables = 0;
      for (const [endA, endB] of [[link.from, link.to], [link.to, link.from]]) {
        const locA = state.board.locations[endA];
        let hasMill = false;
        if (locA) for (const s of locA.slots) if (s.owner === seat && s.industryType === 'cottonMill' && !s.flipped) hasMill = true;
        let hasPort = externalPortIds && externalPortIds.includes(endB);
        if (!hasPort) {
          const locB = state.board.locations[endB];
          if (locB) for (const s of locB.slots) if (s.industryType === 'port' && s.owner !== null && !s.flipped) hasPort = true;
        }
        if (hasMill && hasPort) enables = 1;
      }
      features.push(enables);
      let ownTiles = 0;
      for (const end of [link.from, link.to]) {
        const loc = state.board.locations[end];
        if (loc) for (const s of loc.slots) if (s.owner === seat) ownTiles++;
      }
      features.push(ownTiles / 6);
    } else features.push(0, 0, 0, 0);
  } else features.push(0, 0, 0, 0);

  // Sell Cotton
  if (action.type === 'sellCotton' && action.sales && action.sales.length > 0) {
    const sale = action.sales[0];
    const loc = state.board.locations[sale.millLocation];
    const slot = loc ? loc.slots[sale.millSlot] : null;
    const millData = slot ? (industries.cottonMill?.levels[slot.level] || {}) : {};
    features.push((millData.vp || 0) / 12);
    features.push((millData.incomeGain || 0) / 5);
    features.push(sale.target.type === 'port' ? 1 : 0);
    features.push(action.sales.length / 3);
  } else features.push(0, 0, 0, 0);

  // Loan
  if (action.type === 'takeLoan') {
    features.push((action.amount || 30) / 30);
    features.push(player.money < 10 ? 1 : 0);
  } else features.push(0, 0);

  // Develop
  if (action.type === 'develop') {
    const develops = action.develops || [];
    features.push(develops.length / 2);
    let vpGain = 0, eraSurv = 0;
    for (const indType of develops) {
      const mat = player.industryMat[indType] || [];
      if (mat.length >= 2) {
        const curVP = industries[indType]?.levels[mat[0]]?.vp || 0;
        const nxtVP = industries[indType]?.levels[mat[1]]?.vp || 0;
        vpGain += nxtVP - curVP;
      }
      if (mat.length > 0 && mat[0] <= 1 && state.era === 'canal') eraSurv = 1;
    }
    features.push(vpGain / 18);
    features.push(eraSurv);
  } else features.push(0, 0, 0);

  return new Float32Array(features);
}

// ============ BOT INTERFACE ============

let _net = null;

function getNet() {
  if (!_net) {
    const weightsPath = path.join(__dirname, 'nn-weights.json');
    if (!fs.existsSync(weightsPath)) {
      console.log('[NN] No weights file found at', weightsPath);
      return null;
    }
    _net = new BrassNetInference(weightsPath);
  }
  return _net;
}

/**
 * Neural network bot: choose the best action for the current player.
 * @param {object} state - game state
 * @param {object} player - current player
 * @param {Array} validActions - list of valid actions
 * @param {number} temperature - 0 = greedy, >0 = exploration
 * @returns {object|null} chosen action
 */
function chooseActionNN(state, player, validActions, temperature = 0.1) {
  const net = getNet();
  if (!net || !validActions || validActions.length === 0) return null;
  if (validActions.length === 1) return validActions[0];

  const stateFeatures = encodeGameState(state, player.seat);
  const stateHidden = net.encodeState(stateFeatures);

  const scores = new Float32Array(validActions.length);
  for (let i = 0; i < validActions.length; i++) {
    const actionFeatures = encodeAction(state, player, validActions[i]);
    scores[i] = net.scoreAction(stateHidden, actionFeatures);
  }

  if (temperature <= 0.01) {
    // Greedy
    let best = 0;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[best]) best = i;
    }
    return validActions[best];
  }

  // Temperature-scaled softmax sampling
  const scaled = new Float32Array(scores.length);
  for (let i = 0; i < scores.length; i++) scaled[i] = scores[i] / temperature;
  const probs = softmax(scaled);

  let r = Math.random();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i];
    if (r <= 0) return validActions[i];
  }
  return validActions[validActions.length - 1];
}

module.exports = { chooseActionNN, encodeGameState, encodeAction, getNet };
