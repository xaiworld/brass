// Client-side industry tile data - exact values from the physical game
const INDUSTRIES = {
  cottonMill: {
    name: 'Cotton Mill', icon: 'M', color: '#f8f8f8',
    flipCondition: 'Sell cotton through a port',
    levels: {
      1: { cost: 12, coal: 0, iron: 0, income: 5, vp: 3, tiles: 3, era: 'canal' },
      2: { cost: 14, coal: 1, iron: 0, income: 4, vp: 5, tiles: 3, era: 'both' },
      3: { cost: 16, coal: 1, iron: 1, income: 3, vp: 9, tiles: 3, era: 'both' },
      4: { cost: 18, coal: 1, iron: 1, income: 2, vp: 12, tiles: 3, era: 'both' }
    }
  },
  coalMine: {
    name: 'Coal Mine', icon: 'C', color: '#555',
    flipCondition: 'All coal cubes removed',
    levels: {
      1: { cost: 5, coal: 0, iron: 0, income: 4, vp: 1, cubes: 2, tiles: 1, era: 'canal' },
      2: { cost: 7, coal: 0, iron: 0, income: 7, vp: 2, cubes: 3, tiles: 2, era: 'both' },
      3: { cost: 8, coal: 0, iron: 1, income: 6, vp: 3, cubes: 4, tiles: 2, era: 'both' },
      4: { cost: 10, coal: 0, iron: 1, income: 5, vp: 4, cubes: 5, tiles: 2, era: 'both' }
    }
  },
  ironWorks: {
    name: 'Iron Works', icon: 'I', color: '#d4740e',
    flipCondition: 'All iron cubes removed',
    levels: {
      1: { cost: 5, coal: 1, iron: 0, income: 3, vp: 3, cubes: 4, tiles: 1, era: 'canal' },
      2: { cost: 7, coal: 1, iron: 0, income: 3, vp: 5, cubes: 4, tiles: 1, era: 'both' },
      3: { cost: 9, coal: 1, iron: 0, income: 2, vp: 7, cubes: 5, tiles: 1, era: 'both' },
      4: { cost: 12, coal: 1, iron: 0, income: 1, vp: 9, cubes: 6, tiles: 1, era: 'both' }
    }
  },
  port: {
    name: 'Port', icon: 'P', color: '#2196F3',
    flipCondition: 'Used to sell cotton',
    levels: {
      1: { cost: 6, coal: 0, iron: 0, income: 3, vp: 2, tiles: 1, era: 'canal' },
      2: { cost: 7, coal: 0, iron: 0, income: 3, vp: 4, tiles: 1, era: 'both' },
      3: { cost: 8, coal: 0, iron: 0, income: 4, vp: 6, tiles: 1, era: 'both' },
      4: { cost: 9, coal: 0, iron: 0, income: 4, vp: 9, tiles: 1, era: 'both' }
    }
  },
  shipyard: {
    name: 'Shipyard', icon: 'S', color: '#9C27B0',
    flipCondition: 'Flips immediately when built',
    levels: {
      0: { cost: 0, coal: 0, iron: 0, income: 0, vp: 0, tiles: 2, era: 'none', note: 'Must develop through' },
      1: { cost: 16, coal: 1, iron: 1, income: 2, vp: 10, tiles: 2, era: 'canal' },
      2: { cost: 25, coal: 1, iron: 1, income: 1, vp: 18, tiles: 2, era: 'rail' }
    }
  }
};

function getTileInfo(type, level) {
  const ind = INDUSTRIES[type];
  if (!ind) return null;
  const lv = ind.levels[level];
  if (!lv) return null;
  return { ...lv, name: ind.name, icon: ind.icon, flipCondition: ind.flipCondition };
}
