// Training runner: runs fast bot-vs-bot games for DRL strategy evaluation
// No database persistence during games, no setTimeout delays

const { createInitialState } = require('./game-setup');
const { applyAction } = require('./game-engine');
const { botPersonalities, getAllPersonalityNames, setTierAssignment, DRLBot } = require('./bot-strategies');

const MAX_TURNS_PER_GAME = 500; // safety valve to prevent infinite loops
const LEARNING_RATE = 0.01;

/**
 * Run a complete training game with 3 bots (no humans, no delays)
 * @param {DRLBot} bot1
 * @param {DRLBot} bot2
 * @param {DRLBot} bot3
 * @returns {{ players: Array, scores: Array, winner: string, turns: number, errors: number }}
 */
function runTrainingGame(bot1, bot2, bot3) {
  const bots = [bot1, bot2, bot3];

  // Reset action history for all bots
  for (const bot of bots) {
    bot.resetHistory();
  }

  const players = bots.map((bot, i) => ({
    userId: -(i + 1), // negative IDs for training bots
    username: bot.name,
    color: ['Red', 'Purple', 'Green'][i],
    isBot: true
  }));

  let state = createInitialState(players, 3);
  let turns = 0;
  let errors = 0;

  while (state.phase !== 'finished' && turns < MAX_TURNS_PER_GAME) {
    if (state.phase !== 'actions') break;

    const currentSeat = state.turnOrder[state.currentPlayerIndex];
    const currentPlayer = state.players[currentSeat];
    const bot = bots[currentSeat];

    if (!bot || !currentPlayer || currentPlayer.hand.length === 0) {
      break;
    }

    // Bot chooses action
    const action = bot.chooseAction(state, currentPlayer);
    if (!action) {
      const passAction = { type: 'pass', cardPlayed: currentPlayer.hand[0] };
      const passResult = applyAction(state, currentPlayer.userId, passAction);
      if (passResult.error) break;
      state = passResult.newState;
      turns++;
      continue;
    }

    // Apply action
    const result = applyAction(state, currentPlayer.userId, action);
    if (result.error) {
      errors++;
      // Action failed, fall back to pass
      const passAction = { type: 'pass', cardPlayed: currentPlayer.hand[0] };
      const passResult = applyAction(state, currentPlayer.userId, passAction);
      if (passResult.error) break;
      state = passResult.newState;
    } else {
      state = result.newState;
    }
    turns++;
  }

  // Extract results
  const scores = state.players.map(p => ({
    name: p.username,
    vp: p.vp,
    money: p.money,
    income: p.income
  }));

  const maxVP = Math.max(...scores.map(s => s.vp));
  const avgVP = scores.reduce((sum, s) => sum + s.vp, 0) / scores.length;
  const winner = scores.find(s => s.vp === maxVP)?.name || 'Unknown';

  // Update weights for all bots based on results
  for (let i = 0; i < bots.length; i++) {
    bots[i].updateWeights(scores[i].vp, maxVP, avgVP, LEARNING_RATE);
  }

  return {
    players: scores,
    scores: scores.map(s => s.vp),
    winner,
    turns,
    errors,
    finished: state.phase === 'finished'
  };
}

/**
 * Run a tournament of N games with random bot matchups
 * @param {number} numGames
 * @returns {{ rankings: object, results: Array }}
 */
function runTournament(numGames) {
  const names = getAllPersonalityNames();
  const stats = {};
  for (const name of names) {
    stats[name] = { games: 0, wins: 0, totalVP: 0, avgVP: 0, totalErrors: 0 };
  }

  const results = [];

  for (let i = 0; i < numGames; i++) {
    // Pick 3 random bots (allow duplicates for more matchups)
    const picked = [];
    for (let j = 0; j < 3; j++) {
      picked.push(names[Math.floor(Math.random() * names.length)]);
    }

    const bots = picked.map(n => botPersonalities[n]);
    const result = runTrainingGame(bots[0], bots[1], bots[2]);

    // Update stats
    for (let j = 0; j < 3; j++) {
      const botName = picked[j];
      const score = result.scores[j];
      stats[botName].games++;
      stats[botName].totalVP += score;
      stats[botName].totalErrors = (stats[botName].totalErrors || 0) + result.errors;
      if (result.players[j].name === result.winner && result.players[j].vp === Math.max(...result.scores)) {
        stats[botName].wins++;
      }
    }

    results.push({
      bots: picked,
      scores: result.scores,
      winner: result.winner,
      turns: result.turns,
      errors: result.errors,
      finished: result.finished
    });
  }

  // Calculate averages and rank
  const rankings = {};
  for (const [name, s] of Object.entries(stats)) {
    s.avgVP = s.games > 0 ? Math.round(s.totalVP / s.games) : 0;
    s.winRate = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
    rankings[name] = s;
  }

  return { rankings, results };
}

/**
 * Update tier assignments based on tournament rankings
 * @param {object} rankings - from runTournament
 */
function updateTiers(rankings) {
  const sorted = Object.entries(rankings)
    .filter(([_, s]) => s.games > 0)
    .sort((a, b) => {
      // Sort by win rate first, then avg VP
      if (b[1].winRate !== a[1].winRate) return b[1].winRate - a[1].winRate;
      return b[1].avgVP - a[1].avgVP;
    });

  if (sorted.length >= 3) {
    setTierAssignment('pro', sorted[0][0]);
    setTierAssignment('average', sorted[Math.floor(sorted.length / 2)][0]);
    setTierAssignment('noob', sorted[sorted.length - 1][0]);
  } else if (sorted.length === 2) {
    setTierAssignment('pro', sorted[0][0]);
    setTierAssignment('noob', sorted[1][0]);
  } else if (sorted.length === 1) {
    setTierAssignment('average', sorted[0][0]);
  }
}

// ============ BACKGROUND TRAINING MODE ============

let trainingInterval = null;
let trainingActive = false;
let totalTrainingGames = 0;
let currentRankings = null;

function startTraining(gamesPerBatch, intervalMs) {
  if (trainingActive) return false;
  trainingActive = true;
  const batchSize = gamesPerBatch || 3;
  const interval = intervalMs || 5000;

  console.log('[Training] Starting DRL training mode: ' + batchSize + ' games every ' + interval + 'ms');

  trainingInterval = setInterval(() => {
    try {
      const { rankings, results } = runTournament(batchSize);
      totalTrainingGames += batchSize;

      // Log improvement metrics
      let totalErrors = 0;
      let totalVP = 0;
      let gameCount = 0;
      for (const r of results) {
        totalErrors += r.errors;
        for (const s of r.scores) totalVP += s;
        gameCount++;
      }
      const avgErrors = (totalErrors / gameCount).toFixed(1);
      const avgVP = (totalVP / (gameCount * 3)).toFixed(0);

      // Merge into current rankings
      if (!currentRankings) {
        currentRankings = rankings;
      } else {
        for (const [name, s] of Object.entries(rankings)) {
          if (!currentRankings[name]) {
            currentRankings[name] = s;
          } else {
            currentRankings[name].games += s.games;
            currentRankings[name].wins += s.wins;
            currentRankings[name].totalVP += s.totalVP;
            currentRankings[name].totalErrors = (currentRankings[name].totalErrors || 0) + (s.totalErrors || 0);
            currentRankings[name].avgVP = currentRankings[name].games > 0
              ? Math.round(currentRankings[name].totalVP / currentRankings[name].games)
              : 0;
            currentRankings[name].winRate = currentRankings[name].games > 0
              ? Math.round((currentRankings[name].wins / currentRankings[name].games) * 100)
              : 0;
          }
        }
      }

      // Update tier assignments
      updateTiers(currentRankings);

      // Store results in DB
      try {
        const db = require('./db');
        db.addTrainingResult({
          timestamp: new Date().toISOString(),
          batchSize,
          totalGames: totalTrainingGames,
          rankings: currentRankings,
          tiers: require('./bot-strategies').getTierAssignments(),
          batchAvgErrors: parseFloat(avgErrors),
          batchAvgVP: parseInt(avgVP)
        });
      } catch (e) {
        console.error('[Training] DB save error:', e.message);
      }

      console.log('[Training] Batch complete. Total games: ' + totalTrainingGames +
        ' | Batch avg errors: ' + avgErrors + '/game | Batch avg VP: ' + avgVP);
    } catch (e) {
      console.error('[Training] Error in training batch:', e.message, e.stack);
    }
  }, interval);

  return true;
}

function stopTraining() {
  if (!trainingActive) return false;
  trainingActive = false;
  if (trainingInterval) {
    clearInterval(trainingInterval);
    trainingInterval = null;
  }
  console.log('[Training] Training mode stopped. Total games: ' + totalTrainingGames);
  return true;
}

function isTrainingActive() {
  return trainingActive;
}

function getTrainingStatus() {
  const { getTierAssignments } = require('./bot-strategies');
  return {
    active: trainingActive,
    totalGames: totalTrainingGames,
    rankings: currentRankings,
    tiers: getTierAssignments()
  };
}

module.exports = {
  runTrainingGame,
  runTournament,
  updateTiers,
  startTraining,
  stopTraining,
  isTrainingActive,
  getTrainingStatus
};
