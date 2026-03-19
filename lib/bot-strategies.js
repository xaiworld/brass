// Parameterized bot strategies for training framework
// Each bot personality has different priorities and exploration rates

const { applyAction, getPlayerNetwork, isConnected, getConnectedLocations } = require('./game-engine');
const { locations, links, externalPortIds } = require('./board-data');
const { industries } = require('./industry-data');

// ============ HELPERS (same as bot-engine.js) ============

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

// ============ PARAMETERIZED BOT ============

class ParameterizedBot {
  /**
   * @param {string} name - Bot personality name
   * @param {number} explorationRate - 0-1, chance of adding random noise to scoring
   * @param {object} priorities - weights for different action types
   */
  constructor(name, explorationRate, priorities) {
    this.name = name;
    this.explorationRate = explorationRate;
    this.priorities = {
      cotton: priorities.cotton || 1,
      coal: priorities.coal || 1,
      iron: priorities.iron || 1,
      port: priorities.port || 1,
      link: priorities.link || 1,
      loan: priorities.loan || 1,
      develop: priorities.develop || 1,
      sell: priorities.sell || 1,
      ...priorities
    };
  }

  chooseAction(state, player) {
    const hand = player.hand;
    if (hand.length === 0) return null;

    const candidates = [];

    // Try every card in hand for each action type
    for (const cardId of hand) {
      // Sell cotton actions
      const sellActions = this.findSellActions(state, player, cardId);
      for (const a of sellActions) {
        candidates.push({ action: a, score: this.scoreSell(state, player, a) });
      }

      // Build industry actions
      const buildActions = this.findBuildActions(state, player, cardId);
      for (const a of buildActions) {
        candidates.push({ action: a, score: this.scoreBuild(state, player, a) });
      }

      // Build link actions
      const linkActions = this.findLinkActions(state, player, cardId);
      for (const a of linkActions) {
        candidates.push({ action: a, score: this.scoreLink(state, player, a) });
      }

      // Develop actions
      const devActions = this.findDevelopActions(state, player, cardId);
      for (const a of devActions) {
        candidates.push({ action: a, score: this.scoreDevelop(state, player, a) });
      }

      // Loan actions
      const loanAction = this.findLoanAction(state, player, cardId);
      if (loanAction) {
        candidates.push({ action: loanAction, score: this.scoreLoan(state, player) });
      }
    }

    // Always have pass as fallback
    candidates.push({ action: { type: 'pass', cardPlayed: hand[0] }, score: 0.1 });

    // Add exploration noise
    for (const c of candidates) {
      if (Math.random() < this.explorationRate) {
        c.score += Math.random() * 10;
      }
    }

    // Pick best scoring action
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].action;
  }

  // ============ SCORING FUNCTIONS ============

  scoreSell(state, player, action) {
    let score = 8 * this.priorities.sell;
    // Selling is generally good - flips tiles for VP and income
    if (action.sales) {
      for (const sale of action.sales) {
        const loc = state.board.locations[sale.millLocation];
        if (loc) {
          const slot = loc.slots[sale.millSlot];
          if (slot) {
            const data = industries.cottonMill?.levels[slot.level];
            if (data) score += data.vp * 0.5;
          }
        }
        // Prefer port sales over distant market
        if (sale.target.type === 'port') score += 2;
      }
    }
    return score;
  }

  scoreBuild(state, player, action) {
    let score = 5;
    const { industryType } = action;

    // Apply priority weights
    if (industryType === 'cottonMill') score *= this.priorities.cotton;
    else if (industryType === 'coalMine') score *= this.priorities.coal;
    else if (industryType === 'ironWorks') score *= this.priorities.iron;
    else if (industryType === 'port') score *= this.priorities.port;
    else if (industryType === 'shipyard') score *= 1.5;

    // Higher level tiles are generally better
    const mat = player.industryMat[industryType];
    if (mat && mat.length > 0) {
      const level = mat[0];
      score += level * 1.5;
      const data = industries[industryType]?.levels[level];
      if (data) {
        score += data.vp * 0.3;
        score += data.incomeGain * 0.2;
      }
    }

    // Penalize if low on money
    if (player.money < 15) score -= 3;

    return score;
  }

  scoreLink(state, player, action) {
    let score = 4 * this.priorities.link;
    // Links are good for VP scoring at era end
    const link = state.board.links[action.linkId];
    if (link) {
      // Prefer links connecting to locations with flipped tiles
      const fromLoc = state.board.locations[link.from];
      const toLoc = state.board.locations[link.to];
      if (fromLoc) {
        for (const slot of fromLoc.slots) {
          if (slot.flipped && slot.owner !== null) score += 2;
        }
      }
      if (toLoc) {
        for (const slot of toLoc.slots) {
          if (slot.flipped && slot.owner !== null) score += 2;
        }
      }
    }
    // Rail era links are worth more
    if (state.era === 'rail') score += 2;
    return score;
  }

  scoreDevelop(state, player, action) {
    let score = 3 * this.priorities.develop;
    // Developing is good if stuck with low level tiles in rail era
    if (state.era === 'rail') score += 2;
    if (action.develops) {
      for (const type of action.develops) {
        const mat = player.industryMat[type];
        if (mat && mat.length > 0 && mat[0] <= 1) score += 3; // skip level 1 in rail
      }
    }
    return score;
  }

  scoreLoan(state, player) {
    let score = 2 * this.priorities.loan;
    // More attractive when low on money
    if (player.money < 5) score += 6;
    else if (player.money < 10) score += 4;
    else if (player.money < 15) score += 2;
    // Less attractive with high income already
    if (player.income > 20) score -= 2;
    return score;
  }

  // ============ ACTION FINDERS ============

  findSellActions(state, player, cardId) {
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
                type: 'sellCotton', cardPlayed: cardId,
                sales: [{ millLocation: locId, millSlot: i,
                  target: { type: 'port', location: cLoc, slotIndex: j } }]
              });
            }
          }
        }

        // Try distant market
        if (state.distantMarketDemand > 1 && isConnectedToPortSimple(state, locId)) {
          actions.push({
            type: 'sellCotton', cardPlayed: cardId,
            sales: [{ millLocation: locId, millSlot: i, target: { type: 'distant' } }]
          });
        }
      }
    }
    return actions;
  }

  findBuildActions(state, player, cardId) {
    const actions = [];
    const cardInfo = getCardInfo(cardId);
    const network = getPlayerNetwork(state, player.seat);

    for (const industryType of ['cottonMill', 'coalMine', 'ironWorks', 'port', 'shipyard']) {
      const mat = player.industryMat[industryType];
      if (!mat || mat.length === 0) continue;
      const level = mat[0];
      if (state.era === 'rail' && level <= 1) continue;
      if (industryType === 'shipyard' && level === 0) continue;

      const tileData = industries[industryType]?.levels[level];
      if (!tileData || player.money < tileData.cost) continue;

      for (const [locId, loc] of Object.entries(state.board.locations)) {
        for (let i = 0; i < loc.slots.length; i++) {
          const slot = loc.slots[i];
          if (!slot.allowed.includes(industryType)) continue;
          if (slot.owner !== null) continue;
          if (cardInfo.type === 'location' && cardInfo.location !== locId) continue;
          if (cardInfo.type === 'industry' && network.size > 0 && !network.has(locId)) continue;
          if (state.era === 'canal' && loc.slots.some(s => s.owner === player.seat)) continue;

          actions.push({ type: 'buildIndustry', location: locId, slotIndex: i, industryType, cardPlayed: cardId });
        }
      }
    }
    return actions;
  }

  findLinkActions(state, player, cardId) {
    const actions = [];
    const network = getPlayerNetwork(state, player.seat);
    const era = state.era;

    for (const [linkId, link] of Object.entries(state.board.links)) {
      if (link.owner !== null) continue;
      if (era === 'canal' && !link.canal) continue;
      if (era === 'rail' && !link.rail) continue;
      if (network.size > 0 && !network.has(link.from) && !network.has(link.to)) continue;

      const seg = link.segments || 1;
      if (era === 'canal' && player.money >= 3 * seg) {
        actions.push({ type: 'buildLink', linkId, cardPlayed: cardId });
      } else if (era === 'rail' && player.money >= 5 * seg + 5) {
        // Rough cost check (doesn't check coal availability precisely, but applyAction will validate)
        actions.push({ type: 'buildLink', linkId, cardPlayed: cardId });
      }
    }
    return actions;
  }

  findDevelopActions(state, player, cardId) {
    const actions = [];
    const developable = [];

    for (const industryType of ['cottonMill', 'coalMine', 'ironWorks', 'port', 'shipyard']) {
      const mat = player.industryMat[industryType];
      if (mat && mat.length > 0) {
        developable.push(industryType);
      }
    }

    // Single develop
    for (const type of developable) {
      actions.push({ type: 'develop', cardPlayed: cardId, develops: [type] });
    }

    // Double develop (develop 2 tiles at once)
    for (let i = 0; i < developable.length; i++) {
      for (let j = i; j < developable.length; j++) {
        // Check we have enough tiles if developing same type twice
        if (i === j) {
          const mat = player.industryMat[developable[i]];
          if (mat.length < 2) continue;
        }
        actions.push({ type: 'develop', cardPlayed: cardId, develops: [developable[i], developable[j]] });
      }
    }

    return actions;
  }

  findLoanAction(state, player, cardId) {
    // Rail era: cannot take loan after draw deck exhausted
    if (state.era === 'rail' && state.drawPile.length === 0) return null;
    return { type: 'takeLoan', cardPlayed: cardId, amount: 30 };
  }
}

// ============ NAMED BOT PERSONALITIES ============

const botPersonalities = {
  Cautious_Carl: new ParameterizedBot('Cautious_Carl', 0.05, {
    cotton: 2.0, coal: 0.5, iron: 0.5, port: 2.0, link: 1.0, loan: 0.5, develop: 0.8, sell: 2.5
  }),
  Aggressive_Ada: new ParameterizedBot('Aggressive_Ada', 0.2, {
    cotton: 0.8, coal: 2.0, iron: 2.0, port: 0.8, link: 1.2, loan: 1.5, develop: 1.0, sell: 1.5
  }),
  Builder_Bob: new ParameterizedBot('Builder_Bob', 0.1, {
    cotton: 1.0, coal: 1.0, iron: 1.0, port: 1.0, link: 3.0, loan: 1.0, develop: 0.8, sell: 1.5
  }),
  Wildcard_Wil: new ParameterizedBot('Wildcard_Wil', 0.7, {
    cotton: 1.0, coal: 1.0, iron: 1.0, port: 1.0, link: 1.0, loan: 1.0, develop: 1.0, sell: 1.0
  }),
  Balanced_Bea: new ParameterizedBot('Balanced_Bea', 0.15, {
    cotton: 1.5, coal: 1.5, iron: 1.5, port: 1.5, link: 1.5, loan: 1.0, develop: 1.2, sell: 2.0
  }),
  Devver_Dan: new ParameterizedBot('Devver_Dan', 0.08, {
    cotton: 1.0, coal: 0.8, iron: 0.8, port: 0.8, link: 1.0, loan: 1.2, develop: 3.0, sell: 1.5
  })
};

// Tier assignments (updated by training runner)
const tierAssignments = {
  pro: 'Balanced_Bea',
  average: 'Cautious_Carl',
  noob: 'Wildcard_Wil'
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
  ParameterizedBot,
  botPersonalities,
  getBotByTier,
  getBotByName,
  setTierAssignment,
  getTierAssignments,
  getAllPersonalityNames
};
