// Initialize a new game state
const { locations, links, distantMarketTileValues, distantMarketTileValues2P, DISTANT_MARKET_START, MARKET_SLOTS, MARKET_SLOTS_2P } = require('./board-data');
const { APP_VERSION, GAME_STATE_VERSION } = require('./version');
const { industries } = require('./industry-data');
const { buildDeck, buildTwoPlayerDeck, shuffle, cardsToRemove, twoPlayerRemovedLocations } = require('./card-data');

function createInitialState(players, numPlayers) {
  const is2P = numPlayers === 2;

  // Build and shuffle deck
  let deck = shuffle(is2P ? buildTwoPlayerDeck() : buildDeck());
  const removeCount = cardsToRemove[numPlayers]?.canal || 0;
  deck = deck.slice(removeCount); // remove from top

  const startingMoney = is2P ? 25 : 30;
  const marketSlots = is2P ? MARKET_SLOTS_2P : MARKET_SLOTS;
  const demandTiles = is2P ? distantMarketTileValues2P : distantMarketTileValues;

  // Deal 8 cards to each player
  const playerStates = players.map((p, i) => {
    const hand = deck.splice(0, 8);
    return {
      seat: i,
      userId: p.userId,
      username: p.username,
      isBot: p.isBot || false,
      color: p.color,
      money: startingMoney,
      income: 10, // level 10 = £0 income
      vp: 0,
      spentThisRound: 0,
      hand: hand.map(c => c.id),
      industryMat: buildIndustryMat(),
      developedTiles: [],
      canalRemovedTiles: []
    };
  });

  // Determine which locations and links to use
  const activeLocations = is2P
    ? Object.fromEntries(Object.entries(locations).filter(([id]) => !twoPlayerRemovedLocations.includes(id)))
    : locations;

  // 2-player link modifications:
  // - Remove links involving removed locations
  // - Lancaster-Scotland becomes canal+rail (was rail-only)
  // - Yorkshire only reachable from Colne (remove rochdale-yorkshire)
  // - Remove links to theMidlands (no Midlands external port)
  let activeLinks = links;
  if (is2P) {
    activeLinks = links.filter(link => {
      // Remove links to/from removed locations
      if (twoPlayerRemovedLocations.includes(link.from) || twoPlayerRemovedLocations.includes(link.to)) return false;
      // Remove rochdale-yorkshire (Yorkshire only from Colne)
      if (link.id === 'rochdale-yorkshire') return false;
      // Remove links to The Midlands
      if (link.from === 'theMidlands' || link.to === 'theMidlands') return false;
      return true;
    }).map(link => {
      // Lancaster-Scotland: add canal
      if (link.id === 'lancaster-scotland') {
        return { ...link, canal: true };
      }
      return link;
    });
  }

  // Initialize board
  const boardLocations = {};
  for (const [locId, loc] of Object.entries(activeLocations)) {
    boardLocations[locId] = {
      slots: loc.slots.map(s => ({
        allowed: s.allowed,
        owner: null,
        industryType: null,
        level: null,
        flipped: false,
        resources: 0
      }))
    };
  }

  const boardLinks = {};
  for (const link of activeLinks) {
    boardLinks[link.id] = {
      from: link.from,
      to: link.to,
      canal: link.canal,
      rail: link.rail,
      segments: link.segments || 1,
      through: link.through || null,
      owner: null,
      type: null
    };
  }

  // Random turn order
  const turnOrder = players.map((_, i) => i);
  for (let i = turnOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
  }

  return {
    appVersion: APP_VERSION,
    gameStateVersion: GAME_STATE_VERSION,
    era: 'canal',
    round: 1,
    turnOrder,
    currentPlayerIndex: 0,
    actionsRemaining: 1, // first turn of canal = 1 action
    phase: 'actions',
    numPlayers,
    players: playerStates,
    board: {
      locations: boardLocations,
      links: boardLinks
    },
    marketSlots: marketSlots,
    coalMarket: marketSlots,
    ironMarket: marketSlots,
    distantMarketDemand: DISTANT_MARKET_START,
    distantMarketTiles: shuffle([...demandTiles]),
    distantMarketFlipped: [],
    drawPile: deck.map(c => c.id),
    discardPile: [],
    log: []
  };
}

function buildIndustryMat() {
  // Build mat from industry data: each level appears tilesPerLevel times
  // Tiles are stacked lowest level on top (built first)
  const mat = {};
  for (const [type, ind] of Object.entries(industries)) {
    const tiles = [];
    const levels = Object.keys(ind.levels).map(Number).sort((a, b) => a - b);
    for (const level of levels) {
      const count = ind.tilesPerLevel?.[level] || 1;
      for (let i = 0; i < count; i++) {
        tiles.push(level);
      }
    }
    mat[type] = tiles;
  }
  return mat;
  // Result example: cottonMill: [1,1,1,2,2,2,3,3,3,4,4,4], coalMine: [1,2,2,3,3,4,4], etc.
}

// Prepare state for rail era transition
function transitionToRailEra(state) {
  const newState = JSON.parse(JSON.stringify(state));

  // Remove all canal links
  for (const linkId of Object.keys(newState.board.links)) {
    const link = newState.board.links[linkId];
    if (link.type === 'canal') {
      link.owner = null;
      link.type = null;
    }
  }

  // Remove all level 1 industry tiles from board, track per player
  for (const locId of Object.keys(newState.board.locations)) {
    const loc = newState.board.locations[locId];
    for (const slot of loc.slots) {
      if (slot.owner !== null && slot.level === 1) {
        const player = newState.players[slot.owner];
        if (!player.canalRemovedTiles) player.canalRemovedTiles = [];
        player.canalRemovedTiles.push({ type: slot.industryType, level: slot.level });
        slot.owner = null;
        slot.industryType = null;
        slot.level = null;
        slot.flipped = false;
        slot.resources = 0;
      }
    }
  }

  // Reset distant market and coal/iron markets
  const is2P = newState.numPlayers === 2;
  const marketSlots = is2P ? MARKET_SLOTS_2P : MARKET_SLOTS;
  const demandTiles = is2P ? distantMarketTileValues2P : distantMarketTileValues;

  newState.distantMarketDemand = DISTANT_MARKET_START;
  newState.distantMarketTiles = shuffle([...demandTiles]);
  newState.distantMarketFlipped = [];
  newState.coalMarket = marketSlots;
  newState.ironMarket = marketSlots;

  // Rebuild and deal new cards (2-player uses reduced deck)
  const { shuffle: shuffleFn, buildDeck, buildTwoPlayerDeck } = require('./card-data');
  let deck = shuffleFn(is2P ? buildTwoPlayerDeck() : buildDeck());

  // 2-player: filter out cards for removed locations
  if (is2P) {
    const { twoPlayerRemovedLocations } = require('./card-data');
    deck = deck.filter(c => c.type !== 'location' || !twoPlayerRemovedLocations.includes(c.location));
  }

  const removeCount = cardsToRemove[newState.numPlayers]?.rail || 0;
  deck = deck.slice(removeCount);

  for (const player of newState.players) {
    player.hand = deck.splice(0, 8).map(c => c.id);
    player.spentThisRound = 0;
  }

  newState.drawPile = deck.map(c => c.id);
  newState.discardPile = [];
  newState.era = 'rail';
  newState.round = 1;
  newState.currentPlayerIndex = 0;
  newState.actionsRemaining = 2; // no first-turn restriction in rail era
  newState.phase = 'actions';

  // Recompute turn order by VP (ascending) for rail era start
  newState.turnOrder = newState.players
    .map((p, i) => ({ seat: i, vp: p.vp }))
    .sort((a, b) => a.vp - b.vp)
    .map(p => p.seat);

  newState.log.push({ msg: '=== Rail Era begins ===' });
  return newState;
}

module.exports = { createInitialState, transitionToRailEra };
