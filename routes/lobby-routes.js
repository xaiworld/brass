const express = require('express');
const { requireLogin } = require('../lib/auth');
const { createInitialState } = require('../lib/game-setup');
const { playerColorNames } = require('../lib/industry-data');
const db = require('../lib/db');
const { APP_VERSION, isCompatible } = require('../lib/version');
const { startTraining, stopTraining, isTrainingActive, getTrainingStatus } = require('../lib/training-runner');
const router = express.Router();

router.get('/lobby', requireLogin, (req, res) => {
  const userId = req.session.user.id;

  const allGames = db.findGames({});
  const allUsers = db.get().users.filter(u => !u.is_bot);
  const isAdmin = req.session.user.username === 'xai';

  // Show games where user is a member OR invited
  const myInvites = db.getInvitesForUser(userId);
  const invitedGameIds = myInvites.map(i => i.game_id);

  const myGames = allGames.filter(g => {
    // xai sees ALL games including finished
    if (isAdmin) return true;
    if (g.status === 'finished') return false;
    return db.isGameMember(g.id, userId) || invitedGameIds.includes(g.id);
  }).map(g => {
    const players = db.getGamePlayers(g.id);
    const creator = db.findUserById(g.created_by);
    const gs = db.getGameState(g.id);
    let gameAppVersion = null;
    let compatible = true;
    if (gs) {
      const state = JSON.parse(gs.state);
      gameAppVersion = state.appVersion || null;
      compatible = isCompatible(state.gameStateVersion || 0);
    }
    const isMember = db.isGameMember(g.id, userId);
    const isInvited = !isMember && invitedGameIds.includes(g.id);
    const invites = db.getInvitesForGame(g.id);
    const invitedNames = invites.map(i => { const u = db.findUserById(i.user_id); return u ? u.username : '?'; });
    const playerNames = players.map(p => {
      const u = db.findUserById(p.user_id);
      return { name: u ? u.username : '?', isBot: p.is_bot, color: p.color };
    });
    return {
      ...g,
      player_count: players.length,
      player_names: playerNames,
      is_member: isMember,
      is_invited: isInvited,
      is_creator: g.created_by === userId,
      invited_names: invitedNames,
      creator_name: creator ? creator.username : 'Unknown',
      gameAppVersion,
      compatible
    };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // System stats
  const totalGames = allGames.length;
  const totalPlayers = allUsers.length;

  // Training stats
  const trainingStats = db.getTrainingStats();
  const trainingStatus = getTrainingStatus();

  const userList = allUsers.map(u => u.username).sort();
  res.render('lobby', { games: myGames, appVersion: APP_VERSION, totalGames, totalPlayers, isAdmin, trainingStats, trainingStatus, userList });
});

router.post('/games/create', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const { name, numPlayers, numBots } = req.body;
  const np = Math.min(4, Math.max(3, parseInt(numPlayers) || 4));
  const nb = Math.min(np - 1, Math.max(0, parseInt(numBots) || 0));

  const game = db.createGame(name || 'New Game', np, userId);

  // Creator joins as seat 0
  db.addGamePlayer(game.id, userId, 0, playerColorNames[0]);

  // Add bots
  for (let i = 0; i < nb; i++) {
    const botName = `Bot_${['Alpha', 'Beta', 'Gamma'][i]}`;
    let bot = db.findUserByUsername(botName);
    if (!bot || !bot.is_bot) {
      bot = db.createUser(botName, 'bot', true);
    }
    db.addGamePlayer(game.id, bot.id, i + 1, playerColorNames[i + 1], true);
  }

  res.redirect('/lobby');
});

// Quick game: create + add bots + start immediately
router.post('/games/quick', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const nb = Math.min(3, Math.max(1, parseInt(req.body.numBots) || 2));
  const np = nb + 1;
  const names = ['Lancashire', 'Birmingham', 'Industrial', 'Revolution', 'Canal', 'Railway', 'Empire', 'Trade'];
  const name = names[Math.floor(Math.random() * names.length)] + ' ' + Math.floor(Math.random() * 1000);

  const game = db.createGame(name, np, userId);
  db.addGamePlayer(game.id, userId, 0, playerColorNames[0]);

  for (let i = 0; i < nb; i++) {
    const botName = 'Bot_' + ['Alpha', 'Beta', 'Gamma'][i];
    let bot = db.findUserByUsername(botName);
    if (!bot || !bot.is_bot) {
      bot = db.createUser(botName, 'bot', true);
    }
    db.addGamePlayer(game.id, bot.id, i + 1, playerColorNames[i + 1], true);
  }

  // Start immediately
  const dbPlayers = db.getGamePlayers(game.id);
  const players = dbPlayers.map(p => {
    const user = db.findUserById(p.user_id);
    return { userId: p.user_id, username: user ? user.username : 'Unknown', color: p.color, isBot: p.is_bot };
  });

  const state = createInitialState(players, players.length);
  db.updateGame(game.id, { status: 'active' });
  db.setGameState(game.id, JSON.stringify(state), 0);

  // Redirect first, then trigger bots (so page loads before bots modify state)
  res.redirect('/games/' + game.id);

  // Trigger bots after redirect
  setTimeout(() => {
    const botModule = require('../lib/bot-engine');
    botModule.checkAndPlayBot(game.id);
  }, 2000);
});

router.post('/games/:id/join', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const gameId = parseInt(req.params.id);

  const game = db.findGame(gameId);
  if (!game || game.status !== 'waiting') return res.redirect('/lobby');

  const players = db.getGamePlayers(gameId);
  if (players.length >= game.num_players) return res.redirect('/lobby');
  if (players.some(p => p.user_id === userId)) return res.redirect('/lobby');

  const seat = players.length;
  db.addGamePlayer(gameId, userId, seat, playerColorNames[seat]);

  res.redirect('/lobby');
});

// Invite a user to a game
router.post('/games/:id/invite', requireLogin, (req, res) => {
  const gameId = parseInt(req.params.id);
  const game = db.findGame(gameId);
  if (!game || game.status !== 'waiting' || game.created_by !== req.session.user.id) {
    return res.redirect('/lobby');
  }
  const username = (req.body.username || '').trim();
  if (username) db.inviteToGame(gameId, username);
  res.redirect('/lobby');
});

// Accept invite and join game
router.post('/games/:id/accept-invite', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const gameId = parseInt(req.params.id);
  const game = db.findGame(gameId);
  if (!game || game.status !== 'waiting') return res.redirect('/lobby');

  const players = db.getGamePlayers(gameId);
  if (players.length >= game.num_players) return res.redirect('/lobby');
  if (players.some(p => p.user_id === userId)) return res.redirect('/lobby');

  const seat = players.length;
  db.addGamePlayer(gameId, userId, seat, playerColorNames[seat]);
  db.removeInvite(gameId, userId);
  res.redirect('/lobby');
});

// Delete game (creator only, with confirmation via hidden field)
router.post('/games/:id/delete', requireLogin, (req, res) => {
  const gameId = parseInt(req.params.id);
  const game = db.findGame(gameId);
  if (!game || game.created_by !== req.session.user.id) return res.redirect('/lobby');
  db.deleteGame(gameId);
  res.redirect('/lobby');
});

// Add a bot to a waiting game
router.post('/games/:id/add-bot', requireLogin, (req, res) => {
  const gameId = parseInt(req.params.id);
  const game = db.findGame(gameId);
  if (!game || game.status !== 'waiting' || game.created_by !== req.session.user.id) {
    return res.redirect('/lobby');
  }
  const players = db.getGamePlayers(gameId);
  if (players.length >= game.num_players) return res.redirect('/lobby');

  const botNames = ['Bot_Alpha', 'Bot_Beta', 'Bot_Gamma'];
  const usedBots = players.filter(p => p.is_bot).map(p => {
    const u = db.findUserById(p.user_id);
    return u ? u.username : '';
  });
  const botName = botNames.find(n => !usedBots.includes(n)) || 'Bot_' + Date.now();

  let bot = db.findUserByUsername(botName);
  if (!bot || !bot.is_bot) {
    bot = db.createUser(botName, 'bot', true);
  }
  const seat = players.length;
  db.addGamePlayer(gameId, bot.id, seat, playerColorNames[seat], true);
  res.redirect('/lobby');
});

// GET fallback in case browser navigates directly
router.get('/games/:id/start', requireLogin, (req, res) => {
  res.redirect('/lobby');
});

router.post('/games/:id/start', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const gameId = parseInt(req.params.id);

  const game = db.findGame(gameId);
  if (!game || game.status !== 'waiting' || game.created_by !== userId) {
    return res.redirect('/lobby');
  }

  const dbPlayers = db.getGamePlayers(gameId);
  if (dbPlayers.length < 3) return res.redirect('/lobby');

  const players = dbPlayers.map(p => {
    const user = db.findUserById(p.user_id);
    return {
      userId: p.user_id,
      username: user ? user.username : 'Unknown',
      color: p.color,
      isBot: p.is_bot
    };
  });

  const state = createInitialState(players, players.length);

  db.updateGame(gameId, { status: 'active' });
  db.setGameState(gameId, JSON.stringify(state), 0);

  // Trigger bot play if first player is a bot
  const botModule = require('../lib/bot-engine');
  botModule.checkAndPlayBot(gameId);

  res.redirect(`/games/${gameId}`);
});

// Toggle training mode (xai admin only)
router.post('/admin/toggle-training', requireLogin, (req, res) => {
  if (req.session.user.username !== 'xai') return res.redirect('/lobby');

  if (isTrainingActive()) {
    stopTraining();
  } else {
    const gamesPerBatch = parseInt(req.body.gamesPerBatch) || 3;
    const intervalMs = parseInt(req.body.intervalMs) || 10000;
    startTraining(gamesPerBatch, intervalMs);
  }
  res.redirect('/lobby');
});

// Reset training data (xai admin only)
router.post('/admin/reset-training', requireLogin, (req, res) => {
  if (req.session.user.username !== 'xai') return res.redirect('/lobby');
  if (isTrainingActive()) stopTraining();
  const d = db.get();
  d.trainingResults = [];
  db.save();
  const { resetTierAssignments } = require('../lib/bot-strategies');
  resetTierAssignments();
  console.log('[Training] All training data reset');
  res.redirect('/lobby');
});

module.exports = router;
