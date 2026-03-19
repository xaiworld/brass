// Brass: Lancashire board topology
// Corrected from the official game board

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
  macclesfield: {
    name: 'Macclesfield',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 425, y: 460
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
// No industry slots. Links to/from these cost double (2 segments).
const nonBuildable = {
  northwich:    { name: 'Northwich',     x: 310, y: 455 },
  blackpool:    { name: 'Blackpool',     x: 118, y: 132 },
  southport:    { name: 'Southport',     x: 75,  y: 228 },
  scotland:     { name: 'Scotland',      x: 100, y: 8,   isExternalPort: true },
  yorkshire:    { name: 'Yorkshire',     x: 570, y: 115, isExternalPort: true },
  theMidlands:  { name: 'The Midlands',  x: 360, y: 500, isExternalPort: true }
};

// External port location IDs (for isConnectedToPort checks)
const externalPortIds = ['scotland', 'yorkshire', 'theMidlands'];

// ============ LINKS ============
const links = [
  // Northern
  { id: 'barrow-lancaster', from: 'barrow', to: 'lancaster', canal: false, rail: true, segments: 1 },
  { id: 'lancaster-preston', from: 'lancaster', to: 'preston', canal: true, rail: true, segments: 1 },
  { id: 'lancaster-scotland', from: 'lancaster', to: 'scotland', canal: true, rail: true, segments: 2 },

  // Central upper
  { id: 'preston-blackburn', from: 'preston', to: 'blackburn', canal: false, rail: true, segments: 1 },
  { id: 'preston-wigan', from: 'preston', to: 'wigan', canal: true, rail: true, segments: 1 },
  { id: 'blackburn-burnley', from: 'blackburn', to: 'burnley', canal: true, rail: true, segments: 1 },
  { id: 'blackburn-bolton', from: 'blackburn', to: 'bolton', canal: false, rail: true, segments: 1 },
  { id: 'blackburn-wigan', from: 'blackburn', to: 'wigan', canal: true, rail: true, segments: 1 },
  { id: 'burnley-colne', from: 'burnley', to: 'colne', canal: true, rail: true, segments: 1 },
  { id: 'colne-yorkshire', from: 'colne', to: 'yorkshire', canal: true, rail: true, segments: 2 },

  // Central
  { id: 'wigan-bolton', from: 'wigan', to: 'bolton', canal: true, rail: true, segments: 1 },
  { id: 'wigan-liverpool', from: 'wigan', to: 'liverpool', canal: true, rail: true, segments: 1 },
  { id: 'wigan-southport', from: 'wigan', to: 'southport', canal: false, rail: true, segments: 2 },
  { id: 'southport-liverpool', from: 'southport', to: 'liverpool', canal: false, rail: true, segments: 2 },
  { id: 'bolton-bury', from: 'bolton', to: 'bury', canal: true, rail: true, segments: 1 },
  { id: 'bolton-manchester', from: 'bolton', to: 'manchester', canal: true, rail: true, segments: 1 },
  { id: 'bury-manchester', from: 'bury', to: 'manchester', canal: true, rail: true, segments: 1 },
  { id: 'bury-rochdale', from: 'bury', to: 'rochdale', canal: false, rail: true, segments: 1 },
  { id: 'rochdale-oldham', from: 'rochdale', to: 'oldham', canal: true, rail: true, segments: 1 },
  { id: 'oldham-manchester', from: 'oldham', to: 'manchester', canal: true, rail: true, segments: 1 },

  // Southern
  { id: 'manchester-stockport', from: 'manchester', to: 'stockport', canal: true, rail: true, segments: 1 },
  { id: 'manchester-warrington', from: 'manchester', to: 'warrington', canal: true, rail: true, segments: 1 },
  { id: 'liverpool-warrington', from: 'liverpool', to: 'warrington', canal: true, rail: true, segments: 1 },
  { id: 'liverpool-birkenhead', from: 'liverpool', to: 'birkenhead', canal: false, rail: true, segments: 1 },
  { id: 'liverpool-ellesmerePort', from: 'liverpool', to: 'ellesmerePort', canal: true, rail: true, segments: 1 },
  { id: 'warrington-ellesmerePort', from: 'warrington', to: 'ellesmerePort', canal: true, rail: true, segments: 1 },
  { id: 'northwich-theMidlands', from: 'northwich', to: 'theMidlands', canal: true, rail: true, segments: 2 },
  { id: 'stockport-macclesfield', from: 'stockport', to: 'macclesfield', canal: true, rail: true, segments: 1 },
  { id: 'macclesfield-theMidlands', from: 'macclesfield', to: 'theMidlands', canal: true, rail: true, segments: 2 }
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
  { demand: 0, bonus: 0 }
];

const coalMarketPrices = {
  13: 1, 12: 1, 11: 1, 10: 1, 9: 1, 8: 1,
  7: 2, 6: 2, 5: 2,
  4: 3, 3: 3,
  2: 4,
  1: 5,
  0: 5
};

const ironMarketPrices = {
  12: 1, 11: 1, 10: 1, 9: 1, 8: 1,
  7: 2, 6: 2, 5: 2,
  4: 3, 3: 3,
  2: 4,
  1: 5,
  0: 5
};

const incomeTrack = [
  -10, -9, -8, -7, -6, -5, -4, -3, -2, -1,
  0,
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30
];

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
  externalPortIds,
  links,
  distantMarketTrack,
  coalMarketPrices,
  ironMarketPrices,
  incomeTrack,
  incomeBands
};
