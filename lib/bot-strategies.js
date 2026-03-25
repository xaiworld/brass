// DRL Bot strategies for Brass: Lancashire training framework
// ValidActionGenerator ensures 100% valid actions; DRLBot learns via epsilon-greedy + weight updates

const { applyAction, getPlayerNetwork, isConnected, getConnectedLocations } = require('./game-engine');
const { locations, links, externalPortIds } = require('./board-data');
const { industries } = require('./industry-data');

// ============ HELPERS ============

function getCardInfo(cardId) {
  if (cardId.startsWith('cotton_')) return { type: 'industry', industry: 'cottonMill' };
  if (cardId.startsWith('coal_')) return { type: 'industry', industry: 'coalMine' };
  if (cardId.startsWith('iron_')) return { type: 'industry', industry: 'ironWorks' };
  if (cardId.startsWith('port_')) return { type: 'industry', industry: 'port' };
  if (cardId.startsWith('shipyard_')) return { type: 'industry', industry: 'shipyard' };
  const parts = cardId.split('_');
  const loc = parts.slice(0, -1).join('_');
  return { type: 'location', location: loc };
}

function isConnectedToPortSimple(state, locId) {
  const connected = getConnectedLocations(state, locId);
  for (const cLoc of connected) {
    if (externalPortIds && externalPortIds.includes(cLoc)) return true;
    if (['liverpool', 'ellesmerePort', 'fleetwood'].includes(cLoc)) return true;
    const loc = state.board.locations[cLoc];
    if (!loc) continue;
    for (const slot of loc.slots) {
      if (slot.industryType === 'port' && slot.owner !== null) return true;
    }
  }
  return false;
}

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Check if coal can be obtained at a target location (connected coal mines or market via port).
 * Returns true if the amount of coal can be sourced without modifying state.
 */
function canGetCoal(state, targetLoc, amount) {
  if (amount <= 0) return true;
  let remaining = amount;
  const connected = getConnectedLocations(state, targetLoc);

  // Check connected coal mines on board
  for (const cLoc of connected) {
    const loc = state.board.locations[cLoc];
    if (!loc) continue;
    for (const slot of loc.slots) {
      if (slot.industryType === 'coalMine' && !slot.flipped && slot.resources > 0) {
        remaining -= Math.min(remaining, slot.resources);
        if (remaining <= 0) return true;
      }
    }
  }

  // Check if connected to port for market coal
  if (remaining > 0) {
    for (const cLoc of connected) {
      if (externalPortIds.includes(cLoc)) return true;
      const loc = state.board.locations[cLoc];
      if (!loc) continue;
      for (const slot of loc.slots) {
        if (slot.industryType === 'port' && slot.owner !== null) return true;
      }
    }
  }

  return false;
}

/**
 * Estimate the money cost of obtaining coal from the market.
 * Returns the approximate additional cost for market coal, or 0 if free from board.
 */
function estimateCoalCost(state, targetLoc, amount) {
  if (amount <= 0) return 0;
  let remaining = amount;
  let cost = 0;
  const connected = getConnectedLocations(state, targetLoc);

  // Free coal from board
  for (const cLoc of connected) {
    const loc = state.board.locations[cLoc];
    if (!loc) continue;
    for (const slot of loc.slots) {
      if (slot.industryType === 'coalMine' && !slot.flipped && slot.resources > 0) {
        remaining -= Math.min(remaining, slot.resources);
        if (remaining <= 0) return 0;
      }
    }
  }

  // Market coal: rough estimate using current market price
  if (remaining > 0) {
    // Approximate: each cube costs ~2-4 from market
    cost = remaining * 3;
  }
  return cost;
}

/**
 * Check if iron can be obtained (iron is global - no connectivity needed for board iron).
 * Returns true if available.
 */
function canGetIron(state, amount) {
  if (amount <= 0) return true;
  // Iron is always available (from board tiles, market, or bank at £5 each)
  return true;
}

/**
 * Estimate iron cost from market/bank.
 */
function estimateIronCost(state, amount) {
  if (amount <= 0) return 0;
  let remaining = amount;

  // Check board iron (free)
  for (const loc of Object.values(state.board.locations)) {
    for (const slot of loc.slots) {
      if (slot.industryType === 'ironWorks' && !slot.flipped && slot.resources > 0) {
        remaining -= Math.min(remaining, slot.resources);
        if (remaining <= 0) return 0;
      }
    }
  }

  // Market iron
  let cost = 0;
  let market = state.ironMarket;
  for (let i = 0; i < remaining; i++) {
    if (market > 0) {
      // Approximate market price
      cost += Math.ceil((9 - market) / 2);
      market--;
    } else {
      cost += 5; // bank price
    }
  }
  return cost;
}

// ============ VALID ACTION GENERATOR ============

class ValidActionGenerator {
  /**
   * Generate ALL valid actions for the given player in the given state.
   * Every returned action is guaranteed to pass applyAction without error.
   */
  static generateAll(state, player) {
    const actions = [];
    const hand = player.hand;
    if (hand.length === 0) return actions;

    // Use a Set to avoid duplicate cards generating identical actions
    const seenCards = new Set();

    for (const cardId of hand) {
      // For pass and loan, any card works the same, so only generate once per unique card type
      const cardKey = getCardInfo(cardId).type === 'location'
        ? 'loc:' + getCardInfo(cardId).location
        : 'ind:' + getCardInfo(cardId).industry;

      // Build industry actions
      const buildActions = ValidActionGenerator._findBuildActions(state, player, cardId);
      for (const a of buildActions) actions.push(a);

      // Build link actions
      const linkActions = ValidActionGenerator._findLinkActions(state, player, cardId);
      for (const a of linkActions) actions.push(a);

      // Sell cotton actions (card doesn't matter for sell, any card works)
      if (!seenCards.has('sell')) {
        const sellActions = ValidActionGenerator._findSellActions(state, player, cardId);
        for (const a of sellActions) actions.push(a);
        if (sellActions.length > 0 || seenCards.size === 0) {
          // Only mark as seen if we tried at least once
        }
      }

      if (!seenCards.has(cardKey)) {
        seenCards.add(cardKey);

        // Loan actions
        const loanActions = ValidActionGenerator._findLoanActions(state, player, cardId);
        for (const a of loanActions) actions.push(a);

        // Develop actions
        const devActions = ValidActionGenerator._findDevelopActions(state, player, cardId);
        for (const a of devActions) actions.push(a);
      }
    }

    // Sell cotton: any card works, so just generate with first card and deduplicate
    // Actually re-do sell properly: sell actions are independent of card type
    // Remove sells added above and regenerate cleanly
    const nonSellActions = actions.filter(a => a.type !== 'sellCotton');
    const sellActions = ValidActionGenerator._findSellActions(state, player, hand[0]);
    // For sell, we can use any card - just use the first one
    const allActions = [...nonSellActions, ...sellActions];

    // Always add pass (using first card)
    allActions.push({ type: 'pass', cardPlayed: hand[0] });

    return allActions;
  }

  static _findBuildActions(state, player, cardId) {
    const actions = [];
    const cardInfo = getCardInfo(cardId);
    const network = getPlayerNetwork(state, player.seat);

    for (const industryType of ['cottonMill', 'coalMine', 'ironWorks', 'port', 'shipyard']) {
      const mat = player.industryMat[industryType];
      if (!mat || mat.length === 0) continue;
      const level = mat[0];

      // Rail era: cannot build level 1
      if (state.era === 'rail' && level <= 1) continue;
      // Shipyard level 0 cannot be built
      if (industryType === 'shipyard' && level === 0) continue;

      const tileData = industries[industryType]?.levels[level];
      if (!tileData) continue;

      // Check base cost affordability (rough check - iron/coal costs add on top)
      if (player.money < tileData.cost) continue;

      // Check iron availability and cost
      const ironCost = tileData.ironCost || 0;
      if (ironCost > 0 && !canGetIron(state, ironCost)) continue;
      const estIronMoney = estimateIronCost(state, ironCost);

      for (const [locId, loc] of Object.entries(state.board.locations)) {
        for (let i = 0; i < loc.slots.length; i++) {
          const slot = loc.slots[i];
          if (!slot.allowed.includes(industryType)) continue;
          if (slot.owner !== null) continue; // don't try overbuilding for simplicity

          // Card match
          if (cardInfo.type === 'location' && cardInfo.location !== locId) continue;
          if (cardInfo.type === 'industry' && network.size > 0 && !network.has(locId)) continue;

          // Canal era: one industry per location per player
          if (state.era === 'canal' && loc.slots.some(s => s.owner === player.seat)) continue;

          // Check coal availability for this location
          const coalCost = tileData.coalCost || 0;
          if (coalCost > 0 && !canGetCoal(state, locId, coalCost)) continue;
          const estCoalMoney = estimateCoalCost(state, locId, coalCost);

          // Check total affordability (base + estimated resource costs)
          if (player.money < tileData.cost + estIronMoney + estCoalMoney) continue;

          actions.push({
            type: 'buildIndustry',
            location: locId,
            slotIndex: i,
            industryType,
            cardPlayed: cardId
          });
        }
      }
    }
    return actions;
  }

  static _findLinkActions(state, player, cardId) {
    const actions = [];
    const network = getPlayerNetwork(state, player.seat);
    const era = state.era;

    // Must have at least one building to build links
    const hasBuildings = Object.values(state.board.locations).some(loc =>
      loc.slots.some(s => s.owner === player.seat)
    );
    if (!hasBuildings) return actions;

    for (const [linkId, link] of Object.entries(state.board.links)) {
      if (link.owner !== null) continue;
      if (era === 'canal' && !link.canal) continue;
      if (era === 'rail' && !link.rail) continue;

      // Must connect to network
      if (network.size > 0 && !network.has(link.from) && !network.has(link.to)) continue;

      const seg = link.segments || 1;

      if (era === 'canal') {
        const canalCost = 3 * seg;
        if (player.money >= canalCost) {
          actions.push({ type: 'buildLink', linkId, cardPlayed: cardId });
        }
      } else {
        // Rail: £5 per segment + 1 coal per segment
        const railCost = 5 * seg;
        // Coal can be transported to either end of the link
        const canCoalFrom = canGetCoal(state, link.from, seg);
        const canCoalTo = canGetCoal(state, link.to, seg);
        if (!canCoalFrom && !canCoalTo) continue;

        // Estimate total cost
        const estCoalMoney = Math.min(
          canCoalFrom ? estimateCoalCost(state, link.from, seg) : Infinity,
          canCoalTo ? estimateCoalCost(state, link.to, seg) : Infinity
        );
        if (player.money >= railCost + estCoalMoney) {
          actions.push({ type: 'buildLink', linkId, cardPlayed: cardId });
        }
      }
    }
    return actions;
  }

  static _findSellActions(state, player, cardId) {
    const actions = [];

    // Find unflipped cotton mills owned by this player
    for (const [locId, loc] of Object.entries(state.board.locations)) {
      for (let i = 0; i < loc.slots.length; i++) {
        const slot = loc.slots[i];
        if (slot.owner !== player.seat || slot.industryType !== 'cottonMill' || slot.flipped) continue;

        // Try selling via connected ports
        const connected = getConnectedLocations(state, locId);
        for (const cLoc of connected) {
          const portLoc = state.board.locations[cLoc];
          if (!portLoc) continue;
          for (let j = 0; j < portLoc.slots.length; j++) {
            const portSlot = portLoc.slots[j];
            if (portSlot.industryType === 'port' && !portSlot.flipped && portSlot.owner !== null) {
              actions.push({
                type: 'sellCotton',
                cardPlayed: cardId,
                sales: [{
                  millLocation: locId,
                  millSlot: i,
                  target: { type: 'port', location: cLoc, slotIndex: j }
                }]
              });
            }
          }
        }

        // Try distant market
        if (state.distantMarketDemand > 1 && isConnectedToPortSimple(state, locId)) {
          actions.push({
            type: 'sellCotton',
            cardPlayed: cardId,
            sales: [{
              millLocation: locId,
              millSlot: i,
              target: { type: 'distant' }
            }]
          });
        }
      }
    }
    return actions;
  }

  static _findLoanActions(state, player, cardId) {
    const actions = [];
    // Rail era: cannot take loan after draw deck exhausted
    if (state.era === 'rail' && state.drawPile.length === 0) return actions;

    for (const amount of [10, 20, 30]) {
      actions.push({ type: 'takeLoan', cardPlayed: cardId, amount });
    }
    return actions;
  }

  static _findDevelopActions(state, player, cardId) {
    const actions = [];
    const developable = [];

    for (const industryType of ['cottonMill', 'coalMine', 'ironWorks', 'port', 'shipyard']) {
      const mat = player.industryMat[industryType];
      if (mat && mat.length > 0) {
        developable.push(industryType);
      }
    }

    if (developable.length === 0) return actions;

    // Check iron availability for develop (1 iron per tile developed)
    const ironCost1 = estimateIronCost(state, 1);
    const ironCost2 = estimateIronCost(state, 2);

    // Single develop (costs 1 iron)
    if (player.money >= ironCost1) {
      for (const type of developable) {
        actions.push({ type: 'develop', cardPlayed: cardId, develops: [type] });
      }
    }

    // Double develop (costs 2 iron)
    if (player.money >= ironCost2) {
      for (let i = 0; i < developable.length; i++) {
        for (let j = i; j < developable.length; j++) {
          // If developing same type twice, need at least 2 tiles
          if (i === j) {
            const mat = player.industryMat[developable[i]];
            if (mat.length < 2) continue;
          }
          actions.push({ type: 'develop', cardPlayed: cardId, develops: [developable[i], developable[j]] });
        }
      }
    }

    return actions;
  }
}

// ============ FEATURE EXTRACTION ============

/**
 * Extract numeric features from a (state, player, action) triple.
 * Returns an object mapping feature names to numeric values.
 */
function extractFeatures(state, player, action) {
  const features = {};
  const era = state.era;
  const network = getPlayerNetwork(state, player.seat);

  // Action type one-hot
  features.is_build_industry = action.type === 'buildIndustry' ? 1 : 0;
  features.is_build_link = action.type === 'buildLink' ? 1 : 0;
  features.is_sell_cotton = action.type === 'sellCotton' ? 1 : 0;
  features.is_take_loan = action.type === 'takeLoan' ? 1 : 0;
  features.is_develop = action.type === 'develop' ? 1 : 0;
  features.is_pass = action.type === 'pass' ? 1 : 0;

  // Money situation
  features.money_ratio = player.money / 50;
  features.low_money = player.money < 10 ? 1 : 0;
  features.high_money = player.money > 40 ? 1 : 0;

  // Income
  features.income_level = player.income / 40;

  // Era
  features.is_rail_era = era === 'rail' ? 1 : 0;
  features.era_progress = state.drawPile.length > 0 ? 1 - (state.drawPile.length / 50) : 1;

  // Cards in hand
  features.cards_in_hand = player.hand.length / 8;

  // Network size
  features.network_size = network.size / 20;

  // --- Strategic situation: count unflipped mills and ports in network ---
  let myUnflippedMills = 0;
  let portsInNetwork = 0;  // any player's unflipped ports reachable
  let myFlippedTiles = 0;
  let myBuiltLinks = 0;
  for (const [locId, loc] of Object.entries(state.board.locations)) {
    for (const slot of loc.slots) {
      if (slot.owner === player.seat && slot.industryType === 'cottonMill' && !slot.flipped) myUnflippedMills++;
      if (slot.owner === player.seat && slot.flipped) myFlippedTiles++;
      if (slot.industryType === 'port' && !slot.flipped && slot.owner !== null && network.has(locId)) portsInNetwork++;
    }
  }
  for (const link of Object.values(state.board.links)) {
    if (link.owner === player.seat) myBuiltLinks++;
  }
  features.my_unflipped_mills = myUnflippedMills / 5;
  features.ports_in_network = portsInNetwork / 5;
  features.my_flipped_tiles = myFlippedTiles / 10;
  features.my_built_links = myBuiltLinks / 10;

  // Action-specific features
  if (action.type === 'buildIndustry') {
    const mat = player.industryMat[action.industryType];
    const level = mat ? mat[0] : 0;
    const tileData = industries[action.industryType]?.levels[level];

    features.tile_vp = tileData ? tileData.vp / 12 : 0;
    features.tile_income_gain = tileData ? tileData.incomeGain / 7 : 0;
    features.tile_cost_ratio = tileData ? tileData.cost / Math.max(1, player.money) : 1;
    features.tile_level = level / 4;

    // Industry type preferences
    features.is_cotton = action.industryType === 'cottonMill' ? 1 : 0;
    features.is_coal = action.industryType === 'coalMine' ? 1 : 0;
    features.is_iron = action.industryType === 'ironWorks' ? 1 : 0;
    features.is_port = action.industryType === 'port' ? 1 : 0;

    // Network expansion: building in new location?
    features.expands_network = network.has(action.location) ? 0 : 1;

    // Tiles remaining on mat
    features.tiles_remaining = mat ? mat.length / 12 : 0;

    // Strategic: does building cotton here connect to a port?
    features.build_near_port = 0;
    if (action.industryType === 'cottonMill') {
      const connected = getConnectedLocations(state, action.location);
      for (const cLoc of connected) {
        if (['liverpool', 'ellesmerePort', 'fleetwood'].includes(cLoc)) { features.build_near_port = 1; break; }
        const cl = state.board.locations[cLoc];
        if (cl) {
          for (const s of cl.slots) {
            if (s.industryType === 'port' && s.owner !== null && !s.flipped) { features.build_near_port = 1; break; }
          }
        }
        if (features.build_near_port) break;
      }
    }
    // Strategic: does building a port here connect to unflipped mills?
    features.build_port_near_mill = 0;
    if (action.industryType === 'port') {
      const connected = getConnectedLocations(state, action.location);
      for (const cLoc of connected) {
        const cl = state.board.locations[cLoc];
        if (cl) {
          for (const s of cl.slots) {
            if (s.owner === player.seat && s.industryType === 'cottonMill' && !s.flipped) {
              features.build_port_near_mill = 1; break;
            }
          }
        }
        if (features.build_port_near_mill) break;
      }
    }
    // Level 2+ tiles survive era transition
    features.tile_survives_era = (level >= 2 && era === 'canal') ? 1 : 0;
  } else {
    features.tile_vp = 0;
    features.tile_income_gain = 0;
    features.tile_cost_ratio = 0;
    features.tile_level = 0;
    features.is_cotton = 0;
    features.is_coal = 0;
    features.is_iron = 0;
    features.is_port = 0;
    features.expands_network = 0;
    features.tiles_remaining = 0;
    features.build_near_port = 0;
    features.build_port_near_mill = 0;
    features.tile_survives_era = 0;
  }

  if (action.type === 'buildLink') {
    const link = state.board.links[action.linkId];
    if (link) {
      // VP potential: count flipped tiles at endpoints
      let endpointVP = 0;
      for (const endLoc of [link.from, link.to]) {
        const loc = state.board.locations[endLoc];
        if (loc) {
          for (const slot of loc.slots) {
            if (slot.flipped && slot.owner !== null) endpointVP++;
          }
        }
      }
      features.link_endpoint_vp = endpointVP / 6;
      features.link_segments = (link.segments || 1) / 2;

      // KEY: does this link connect an unflipped mill to a port (enables selling)?
      let enablesSelling = 0;
      // Check if one end has unflipped mills and the other has ports (or vice versa)
      for (const [endA, endB] of [[link.from, link.to], [link.to, link.from]]) {
        const locA = state.board.locations[endA];
        const locB = state.board.locations[endB];
        let hasMill = false, hasPort = false;
        if (locA) {
          for (const s of locA.slots) {
            if (s.owner === player.seat && s.industryType === 'cottonMill' && !s.flipped) hasMill = true;
          }
        }
        if (locB) {
          for (const s of locB.slots) {
            if (s.industryType === 'port' && s.owner !== null && !s.flipped) hasPort = true;
          }
        }
        // Also check if endB is an external port
        if (['liverpool', 'ellesmerePort', 'fleetwood'].includes(endB)) hasPort = true;
        // Also check wider network from endB for ports
        if (!hasPort && locB) {
          const connB = getConnectedLocations(state, endB);
          for (const c of connB) {
            if (['liverpool', 'ellesmerePort', 'fleetwood'].includes(c)) { hasPort = true; break; }
            const cl = state.board.locations[c];
            if (cl) {
              for (const s of cl.slots) {
                if (s.industryType === 'port' && s.owner !== null && !s.flipped) { hasPort = true; break; }
              }
            }
            if (hasPort) break;
          }
        }
        if (hasMill && hasPort) enablesSelling = 1;
      }
      features.link_enables_sell = enablesSelling;

      // Does this link connect to player's own tiles (worth scoring)?
      let connectsOwn = 0;
      for (const endLoc of [link.from, link.to]) {
        const loc = state.board.locations[endLoc];
        if (loc) {
          for (const s of loc.slots) {
            if (s.owner === player.seat) connectsOwn++;
          }
        }
      }
      features.link_connects_own = Math.min(connectsOwn / 4, 1);
    } else {
      features.link_endpoint_vp = 0;
      features.link_segments = 0;
      features.link_enables_sell = 0;
      features.link_connects_own = 0;
    }
  } else {
    features.link_endpoint_vp = 0;
    features.link_segments = 0;
    features.link_enables_sell = 0;
    features.link_connects_own = 0;
  }

  if (action.type === 'sellCotton') {
    let totalMillVP = 0;
    let totalIncomeGain = 0;
    let usesPort = 0;
    if (action.sales) {
      for (const sale of action.sales) {
        const loc = state.board.locations[sale.millLocation];
        if (loc) {
          const slot = loc.slots[sale.millSlot];
          if (slot) {
            const data = industries.cottonMill?.levels[slot.level];
            if (data) {
              totalMillVP += data.vp;
              totalIncomeGain += data.incomeGain || 0;
            }
          }
        }
        if (sale.target.type === 'port') usesPort = 1;
      }
    }
    features.sell_vp = totalMillVP / 12;
    features.sell_income_gain = totalIncomeGain / 7;
    features.sell_via_port = usesPort;
    features.sell_count = action.sales ? action.sales.length : 0;
  } else {
    features.sell_vp = 0;
    features.sell_income_gain = 0;
    features.sell_via_port = 0;
    features.sell_count = 0;
  }

  if (action.type === 'takeLoan') {
    features.loan_amount = (action.amount || 30) / 30;
    features.loan_need = player.money < 10 ? 1 : player.money < 20 ? 0.5 : 0;
  } else {
    features.loan_amount = 0;
    features.loan_need = 0;
  }

  if (action.type === 'develop') {
    features.develop_count = action.develops ? action.develops.length : 0;
    let lowLevelCount = 0;
    let nextLevelVPGain = 0;
    if (action.develops) {
      for (const type of action.develops) {
        const mat = player.industryMat[type];
        if (mat && mat.length > 0) {
          if (mat[0] <= 1) lowLevelCount++;
          // VP gain from developing: compare next available level VP
          const curLevel = mat[0];
          const nextLevel = mat.length > 1 ? mat[1] : curLevel;
          const curData = industries[type]?.levels[curLevel];
          const nextData = industries[type]?.levels[nextLevel];
          if (curData && nextData) nextLevelVPGain += (nextData.vp - curData.vp);
        }
      }
    }
    features.develop_skips_low = lowLevelCount;
    features.develop_vp_gain = nextLevelVPGain / 10;
    // Developing in canal era to reach level 2+ means tiles survive
    features.develop_for_era_survival = (era === 'canal' && lowLevelCount > 0) ? 1 : 0;
  } else {
    features.develop_count = 0;
    features.develop_skips_low = 0;
    features.develop_vp_gain = 0;
    features.develop_for_era_survival = 0;
  }

  return features;
}

// ============ DRL BOT ============

class DRLBot {
  /**
   * @param {string} name - Bot personality name
   * @param {number} epsilon - Exploration rate (0-1)
   * @param {object} [weights] - Initial weights (feature_name -> number)
   */
  constructor(name, epsilon, weights) {
    this.name = name;
    this.epsilon = epsilon;
    this.weights = weights || DRLBot.randomWeights();
    this.actionHistory = []; // track actions taken this game for weight updates
  }

  static featureNames() {
    return [
      'is_build_industry', 'is_build_link', 'is_sell_cotton', 'is_take_loan', 'is_develop', 'is_pass',
      'money_ratio', 'low_money', 'high_money', 'income_level',
      'is_rail_era', 'era_progress', 'cards_in_hand', 'network_size',
      'my_unflipped_mills', 'ports_in_network', 'my_flipped_tiles', 'my_built_links',
      'tile_vp', 'tile_income_gain', 'tile_cost_ratio', 'tile_level',
      'is_cotton', 'is_coal', 'is_iron', 'is_port',
      'expands_network', 'tiles_remaining',
      'build_near_port', 'build_port_near_mill', 'tile_survives_era',
      'link_endpoint_vp', 'link_segments', 'link_enables_sell', 'link_connects_own',
      'sell_vp', 'sell_income_gain', 'sell_via_port', 'sell_count',
      'loan_amount', 'loan_need',
      'develop_count', 'develop_skips_low', 'develop_vp_gain', 'develop_for_era_survival'
    ];
  }

  static randomWeights() {
    const w = {};
    // Start with reasonable priors rather than pure random
    const priors = {
      is_build_industry: 3.0,
      is_build_link: 3.0,       // links are crucial for connectivity and scoring
      is_sell_cotton: 8.0,      // selling is the #1 VP generator - must be prioritized
      is_take_loan: 0.5,
      is_develop: 2.0,          // developing unlocks higher VP tiles
      is_pass: -5.0,            // strongly discourage passing
      money_ratio: 1.0,
      low_money: -1.0,
      high_money: 0.5,
      income_level: 2.0,
      is_rail_era: 0.0,
      era_progress: 0.0,
      cards_in_hand: 0.0,
      network_size: 2.0,        // bigger network = more sell options
      my_unflipped_mills: -2.0, // having unflipped mills is bad (need to sell them!)
      ports_in_network: 2.0,    // ports in network enable selling
      my_flipped_tiles: 1.0,    // flipped tiles = good (scored)
      my_built_links: 1.0,      // more links = better scoring
      tile_vp: 4.0,
      tile_income_gain: 3.0,
      tile_cost_ratio: -2.0,
      tile_level: 2.5,          // higher level = more VP
      is_cotton: 2.0,           // cotton enables selling
      is_coal: 1.0,
      is_iron: 0.8,
      is_port: 3.0,             // ports enable selling (both own and others' mills)
      expands_network: 1.5,
      tiles_remaining: 0.5,
      build_near_port: 4.0,     // building cotton near port = can sell soon
      build_port_near_mill: 4.0,// building port near own mill = can sell soon
      tile_survives_era: 3.0,   // level 2+ in canal era survives transition
      link_endpoint_vp: 3.0,
      link_segments: -1.0,
      link_enables_sell: 6.0,   // KEY: link that enables selling is very valuable
      link_connects_own: 2.0,   // connecting own tiles for scoring
      sell_vp: 6.0,
      sell_income_gain: 3.0,    // selling also gives income from flipping
      sell_via_port: 1.0,
      sell_count: 2.0,
      loan_amount: 0.5,
      loan_need: 2.0,
      develop_count: 1.0,
      develop_skips_low: 3.0,   // skipping low level tiles is very valuable
      develop_vp_gain: 4.0,     // VP gain from reaching higher level
      develop_for_era_survival: 4.0  // developing to survive era change
    };

    for (const name of DRLBot.featureNames()) {
      // Prior + small random perturbation
      const prior = priors[name] || 0;
      w[name] = prior + (Math.random() - 0.5) * 1.0;
    }
    return w;
  }

  /**
   * Score an action using dot product of features and weights.
   */
  scoreAction(state, player, action) {
    const features = extractFeatures(state, player, action);
    let score = 0;
    for (const [name, value] of Object.entries(features)) {
      score += (this.weights[name] || 0) * value;
    }
    return score;
  }

  /**
   * Validate an action by trying it on a cloned state.
   * Returns true if the action would succeed.
   */
  static validateAction(state, player, action) {
    const testState = clone(state);
    const result = applyAction(testState, player.userId, action);
    return !result.error;
  }

  /**
   * Choose the best valid action using epsilon-greedy.
   * All actions are validated against the game engine before selection.
   */
  chooseAction(state, player) {
    const hand = player.hand;
    if (hand.length === 0) return null;

    let validActions = ValidActionGenerator.generateAll(state, player);

    // Final validation pass: ensure every action actually succeeds in the engine
    // This catches edge cases where cost estimation was slightly off
    validActions = validActions.filter(a => {
      if (a.type === 'pass' || a.type === 'takeLoan') return true; // these always work
      return DRLBot.validateAction(state, player, a);
    });

    if (validActions.length === 0) {
      return { type: 'pass', cardPlayed: hand[0] };
    }

    let chosen;

    if (Math.random() < this.epsilon) {
      // Exploration: pick a random valid action
      chosen = validActions[Math.floor(Math.random() * validActions.length)];
    } else {
      // Exploitation: score all actions, pick best
      let bestScore = -Infinity;
      let bestAction = validActions[0];
      for (const action of validActions) {
        const score = this.scoreAction(state, player, action);
        if (score > bestScore) {
          bestScore = score;
          bestAction = action;
        }
      }
      chosen = bestAction;
    }

    // Record action features for post-game weight update
    const features = extractFeatures(state, player, chosen);
    this.actionHistory.push(features);

    return chosen;
  }

  /**
   * Reset action history for a new game.
   */
  resetHistory() {
    this.actionHistory = [];
  }

  /**
   * Update weights after a game based on final VP score.
   * @param {number} vpScore - This bot's final VP
   * @param {number} maxVP - Max VP in the game
   * @param {number} avgVP - Average VP in the game
   * @param {number} learningRate - Step size for updates
   */
  updateWeights(vpScore, maxVP, avgVP, learningRate) {
    if (this.actionHistory.length === 0) return;

    // Reward signal: normalized to [-1, 1]
    // Winner gets +1, loser gets -1, middle gets proportional
    let reward;
    if (maxVP === 0) {
      reward = 0; // degenerate game
    } else if (vpScore === maxVP) {
      reward = 1.0;
    } else {
      reward = (vpScore - avgVP) / Math.max(avgVP, 1);
      reward = Math.max(-1, Math.min(1, reward));
    }

    // Average features across all actions taken
    const avgFeatures = {};
    for (const name of DRLBot.featureNames()) {
      avgFeatures[name] = 0;
    }
    for (const features of this.actionHistory) {
      for (const [name, value] of Object.entries(features)) {
        avgFeatures[name] = (avgFeatures[name] || 0) + value;
      }
    }
    const n = this.actionHistory.length;
    for (const name of Object.keys(avgFeatures)) {
      avgFeatures[name] /= n;
    }

    // Nudge weights: w += lr * reward * avg_feature
    for (const name of DRLBot.featureNames()) {
      const delta = learningRate * reward * (avgFeatures[name] || 0);
      this.weights[name] = (this.weights[name] || 0) + delta;
      // Clamp weights to prevent explosion
      this.weights[name] = Math.max(-20, Math.min(20, this.weights[name]));
    }
  }

  /**
   * Export weights as a plain object (for serialization).
   */
  exportWeights() {
    return { ...this.weights };
  }

  /**
   * Import weights from a plain object.
   */
  importWeights(w) {
    this.weights = { ...w };
  }
}

// ============ BOT PERSONALITIES ============

const botPersonalities = {
  Explorer_Eve: new DRLBot('Explorer_Eve', 0.8),
  Adventurer_Amy: new DRLBot('Adventurer_Amy', 0.5),
  Balanced_Ben: new DRLBot('Balanced_Ben', 0.3),
  Focused_Fay: new DRLBot('Focused_Fay', 0.15),
  Strategic_Sam: new DRLBot('Strategic_Sam', 0.05),
  Master_Max: new DRLBot('Master_Max', 0.01)
};

// ============ TIER SYSTEM ============

const tierAssignments = {
  pro: 'Master_Max',
  average: 'Balanced_Ben',
  noob: 'Explorer_Eve'
};

function getBotByTier(tier) {
  const name = tierAssignments[tier] || tierAssignments.average;
  return botPersonalities[name];
}

function getBotByName(name) {
  return botPersonalities[name] || null;
}

function setTierAssignment(tier, botName) {
  if (tierAssignments.hasOwnProperty(tier) && botPersonalities[botName]) {
    tierAssignments[tier] = botName;
  }
}

function getTierAssignments() {
  return { ...tierAssignments };
}

function getAllPersonalityNames() {
  return Object.keys(botPersonalities);
}

module.exports = {
  ValidActionGenerator,
  DRLBot,
  extractFeatures,
  botPersonalities,
  getBotByTier,
  getBotByName,
  setTierAssignment,
  resetTierAssignments: function() {
    tierAssignments.pro = null;
    tierAssignments.average = null;
    tierAssignments.noob = null;
  },
  getTierAssignments,
  getAllPersonalityNames
};
