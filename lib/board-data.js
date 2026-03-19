// Brass: Lancashire board topology
// Corrected from the official game board map
// Coordinates are for SVG overlay rendering on top of the board image

// ============ BUILDABLE LOCATIONS ============
const locations = {
  lancaster: {
    name: 'Lancaster',
    slots: [
      { allowed: ['port'] },
      { allowed: ['cottonMill', 'port'] }
    ],
    x: 248, y: 58
  },
  barrow: {
    name: 'Barrow-in-Furness',
    slots: [
      { allowed: ['port'] },
      { allowed: ['shipyard'] }
    ],
    x: 108, y: 38
  },
  fleetwood: {
    name: 'Fleetwood',
    slots: [
      { allowed: ['port'] }
    ],
    x: 138, y: 85
  },
  preston: {
    name: 'Preston',
    slots: [
      { allowed: ['port'] },
      { allowed: ['cottonMill', 'port'] },
      { allowed: ['cottonMill', 'port'] }
    ],
    x: 228, y: 145
  },
  blackburn: {
    name: 'Blackburn',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['ironWorks'] }
    ],
    x: 345, y: 142
  },
  burnley: {
    name: 'Burnley',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] }
    ],
    x: 430, y: 100
  },
  colne: {
    name: 'Colne',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 518, y: 70
  },
  wigan: {
    name: 'Wigan',
    slots: [
      { allowed: ['coalMine'] },
      { allowed: ['coalMine'] }
    ],
    x: 195, y: 252
  },
  bolton: {
    name: 'Bolton',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['ironWorks'] }
    ],
    x: 325, y: 235
  },
  bury: {
    name: 'Bury',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] }
    ],
    x: 415, y: 215
  },
  rochdale: {
    name: 'Rochdale',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['ironWorks'] }
    ],
    x: 505, y: 198
  },
  oldham: {
    name: 'Oldham',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] }
    ],
    x: 515, y: 278
  },
  manchester: {
    name: 'Manchester',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['ironWorks'] }
    ],
    x: 400, y: 335
  },
  stockport: {
    name: 'Stockport',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 475, y: 405
  },
  liverpool: {
    name: 'Liverpool',
    slots: [
      { allowed: ['port'] },
      { allowed: ['port'] },
      { allowed: ['port'] },
      { allowed: ['shipyard'] }
    ],
    x: 65, y: 315
  },
  birkenhead: {
    name: 'Birkenhead',
    slots: [
      { allowed: ['shipyard'] }
    ],
    x: 48, y: 405
  },
  warrington: {
    name: 'Warrington & Runcorn',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['port'] }
    ],
    x: 235, y: 378
  },
  ellesmerePort: {
    name: 'Ellesmere Port',
    slots: [
      { allowed: ['port'] }
    ],
    x: 145, y: 445
  }
};

// ============ NON-BUILDABLE LOCATIONS ============
// These are waypoints on the map - links through them cost double (count as 2 segments)
const nonBuildable = {
  northwich: { name: 'Northwich', x: 310, y: 455 },
  blackpool: { name: 'Blackpool', x: 118, y: 132 },
  southport: { name: 'Southport', x: 75, y: 228 }
};

// ============ EXTERNAL PORTS ============
// Permanent port connections on the board edges for selling cotton
// These are always accessible - no link building needed
const externalPorts = {
  scotland: {
    name: 'Scotland',
    connectedTo: ['lancaster'],
    x: 100, y: 8
  },
  yorkshire: {
    name: 'Yorkshire',
    connectedTo: ['colne', 'burnley', 'rochdale'],
    x: 570, y: 115
  },
  theMidlands: {
    name: 'The Midlands',
    connectedTo: ['ellesmerePort', 'stockport'],
    x: 360, y: 500
  }
};

// ============ LINKS ============
// canal: available in Canal era, rail: available in Rail era
// segments: 1 = normal, 2 = passes through non-buildable location (double cost)
// through: which non-buildable location the link passes through (if segments=2)
const links = [
  // Northern connections
  { id: 'barrow-lancaster', from: 'barrow', to: 'lancaster', canal: false, rail: true, segments: 1 },
  { id: 'lancaster-fleetwood', from: 'lancaster', to: 'fleetwood', canal: true, rail: true, segments: 1 },
  { id: 'lancaster-preston', from: 'lancaster', to: 'preston', canal: true, rail: true, segments: 1 },
  { id: 'fleetwood-preston', from: 'fleetwood', to: 'preston', canal: true, rail: true, segments: 2, through: 'blackpool' },

  // Central upper
  { id: 'preston-blackburn', from: 'preston', to: 'blackburn', canal: true, rail: true, segments: 1 },
  { id: 'preston-wigan', from: 'preston', to: 'wigan', canal: true, rail: true, segments: 1 },
  { id: 'blackburn-burnley', from: 'blackburn', to: 'burnley', canal: true, rail: true, segments: 1 },
  { id: 'blackburn-bolton', from: 'blackburn', to: 'bolton', canal: false, rail: true, segments: 1 },
  { id: 'burnley-colne', from: 'burnley', to: 'colne', canal: true, rail: true, segments: 1 },

  // Central
  { id: 'wigan-bolton', from: 'wigan', to: 'bolton', canal: true, rail: true, segments: 1 },
  { id: 'wigan-liverpool', from: 'wigan', to: 'liverpool', canal: true, rail: true, segments: 2, through: 'southport' },
  { id: 'bolton-bury', from: 'bolton', to: 'bury', canal: true, rail: true, segments: 1 },
  { id: 'bolton-manchester', from: 'bolton', to: 'manchester', canal: true, rail: true, segments: 1 },
  { id: 'bury-manchester', from: 'bury', to: 'manchester', canal: true, rail: true, segments: 1 },
  { id: 'bury-rochdale', from: 'bury', to: 'rochdale', canal: false, rail: true, segments: 1 },
  { id: 'rochdale-oldham', from: 'rochdale', to: 'oldham', canal: true, rail: true, segments: 1 },
  { id: 'oldham-manchester', from: 'oldham', to: 'manchester', canal: true, rail: true, segments: 1 },

  // Southern / Liverpool area
  { id: 'manchester-stockport', from: 'manchester', to: 'stockport', canal: true, rail: true, segments: 1 },
  { id: 'manchester-warrington', from: 'manchester', to: 'warrington', canal: true, rail: true, segments: 1 },
  { id: 'liverpool-warrington', from: 'liverpool', to: 'warrington', canal: true, rail: true, segments: 1 },
  { id: 'liverpool-birkenhead', from: 'liverpool', to: 'birkenhead', canal: false, rail: true, segments: 1 },
  { id: 'liverpool-ellesmerePort', from: 'liverpool', to: 'ellesmerePort', canal: true, rail: true, segments: 1 },
  { id: 'warrington-ellesmerePort', from: 'warrington', to: 'ellesmerePort', canal: true, rail: true, segments: 2, through: 'northwich' }
];

// Distant cotton market demand track
const distantMarketTrack = [
  { demand: 8, bonus: 5 },
  { demand: 7, bonus: 4 },
  { demand: 6, bonus: 3 },
  { demand: 5, bonus: 3 },
  { demand: 4, bonus: 2 },
  { demand: 3, bonus: 2 },
  { demand: 2, bonus: 1 },
  { demand: 1, bonus: 1 },
  { demand: 0, bonus: 0 }  // bottomed out
];

// Coal market price track (price based on cubes remaining)
const coalMarketPrices = {
  13: 1, 12: 1, 11: 1, 10: 1, 9: 1, 8: 1,
  7: 2, 6: 2, 5: 2,
  4: 3, 3: 3,
  2: 4,
  1: 5,
  0: 5  // empty - must pay 5 from bank
};

// Iron market price track
const ironMarketPrices = {
  12: 1, 11: 1, 10: 1, 9: 1, 8: 1,
  7: 2, 6: 2, 5: 2,
  4: 3, 3: 3,
  2: 4,
  1: 5,
  0: 5  // empty - must pay 5 from bank
};

// Income track: maps income level to actual income received
const incomeTrack = [
  -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, // levels 0-9
  0,   // level 10
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,           // levels 11-20
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,   // levels 21-30
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30    // levels 31-40
];

// Income band sizes (for loan calculations)
const incomeBands = [
  { min: -10, max: -6, levels: 5 },
  { min: -5, max: -1, levels: 5 },
  { min: 0, max: 0, levels: 1 },
  { min: 1, max: 5, levels: 5 },
  { min: 6, max: 10, levels: 5 },
  { min: 11, max: 20, levels: 10 },
  { min: 21, max: 30, levels: 10 },
  { min: 31, max: 40, levels: 10 }
];

module.exports = {
  locations,
  nonBuildable,
  links,
  externalPorts,
  distantMarketTrack,
  coalMarketPrices,
  ironMarketPrices,
  incomeTrack,
  incomeBands
};
