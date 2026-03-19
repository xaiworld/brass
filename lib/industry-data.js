// Brass: Lancashire industry tile definitions
// Exact values from the physical game tiles

const industries = {
  cottonMill: {
    name: 'Cotton Mill',
    color: '#e8e8e8',
    icon: 'M',
    levels: {
      1: { cost: 12, coalCost: 0, ironCost: 0, incomeGain: 5, vp: 3, canBuildCanal: true, canBuildRail: false },
      2: { cost: 14, coalCost: 1, ironCost: 0, incomeGain: 4, vp: 5, canBuildCanal: true, canBuildRail: true },
      3: { cost: 16, coalCost: 1, ironCost: 1, incomeGain: 3, vp: 9, canBuildCanal: true, canBuildRail: true },
      4: { cost: 18, coalCost: 1, ironCost: 1, incomeGain: 2, vp: 12, canBuildCanal: true, canBuildRail: true }
    },
    flipCondition: 'sell',
    // 3 tiles of each level per player
    tilesPerLevel: { 1: 3, 2: 3, 3: 3, 4: 3 }
  },
  coalMine: {
    name: 'Coal Mine',
    color: '#4a4a4a',
    icon: 'C',
    levels: {
      1: { cost: 5, coalCost: 0, ironCost: 0, incomeGain: 4, vp: 1, resources: 2, canBuildCanal: true, canBuildRail: false },
      2: { cost: 7, coalCost: 0, ironCost: 0, incomeGain: 7, vp: 2, resources: 3, canBuildCanal: true, canBuildRail: true },
      3: { cost: 8, coalCost: 0, ironCost: 1, incomeGain: 6, vp: 3, resources: 4, canBuildCanal: true, canBuildRail: true },
      4: { cost: 10, coalCost: 0, ironCost: 1, incomeGain: 5, vp: 4, resources: 5, canBuildCanal: true, canBuildRail: true }
    },
    flipCondition: 'empty',
    // 1 tile at L1, 2 at L2-L4
    tilesPerLevel: { 1: 1, 2: 2, 3: 2, 4: 2 }
  },
  ironWorks: {
    name: 'Iron Works',
    color: '#d4740e',
    icon: 'I',
    levels: {
      1: { cost: 5, coalCost: 1, ironCost: 0, incomeGain: 3, vp: 3, resources: 4, canBuildCanal: true, canBuildRail: false },
      2: { cost: 7, coalCost: 1, ironCost: 0, incomeGain: 3, vp: 5, resources: 4, canBuildCanal: true, canBuildRail: true },
      3: { cost: 9, coalCost: 1, ironCost: 0, incomeGain: 2, vp: 7, resources: 5, canBuildCanal: true, canBuildRail: true },
      4: { cost: 12, coalCost: 1, ironCost: 0, incomeGain: 1, vp: 9, resources: 6, canBuildCanal: true, canBuildRail: true }
    },
    flipCondition: 'empty',
    // 1 tile per level
    tilesPerLevel: { 1: 1, 2: 1, 3: 1, 4: 1 }
  },
  port: {
    name: 'Port',
    color: '#2196F3',
    icon: 'P',
    levels: {
      1: { cost: 6, coalCost: 0, ironCost: 0, incomeGain: 3, vp: 2, canBuildCanal: true, canBuildRail: false },
      2: { cost: 7, coalCost: 0, ironCost: 0, incomeGain: 3, vp: 4, canBuildCanal: true, canBuildRail: true },
      3: { cost: 8, coalCost: 0, ironCost: 0, incomeGain: 4, vp: 6, canBuildCanal: true, canBuildRail: true },
      4: { cost: 9, coalCost: 0, ironCost: 0, incomeGain: 4, vp: 9, canBuildCanal: true, canBuildRail: true }
    },
    flipCondition: 'sell',
    tilesPerLevel: { 1: 1, 2: 1, 3: 1, 4: 1 }
  },
  shipyard: {
    name: 'Shipyard',
    color: '#9C27B0',
    icon: 'S',
    levels: {
      0: { cost: 0, coalCost: 0, ironCost: 0, incomeGain: 0, vp: 0, canBuildCanal: false, canBuildRail: false },
      1: { cost: 16, coalCost: 1, ironCost: 1, incomeGain: 2, vp: 10, canBuildCanal: true, canBuildRail: false },
      2: { cost: 25, coalCost: 1, ironCost: 1, incomeGain: 1, vp: 18, canBuildCanal: false, canBuildRail: true }
    },
    flipCondition: 'immediate',
    // 2 of each level
    tilesPerLevel: { 0: 2, 1: 2, 2: 2 }
  }
};

// Player colors
const playerColors = ['#e74c3c', '#9b59b6', '#2ecc71', '#f39c12']; // red, purple, green, yellow
const playerColorNames = ['Red', 'Purple', 'Green', 'Yellow'];

module.exports = { industries, playerColors, playerColorNames };
