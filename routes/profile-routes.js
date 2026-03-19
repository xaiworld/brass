const express = require('express');
const { requireLogin } = require('../lib/auth');
const db = require('../lib/db');
const router = express.Router();

router.get('/profile', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const stats = db.getUserStats(userId);
  res.render('profile', { stats });
});

// View another user's stats
router.get('/profile/:username', requireLogin, (req, res) => {
  const user = db.findUserByUsername(req.params.username);
  if (!user || user.is_bot) return res.redirect('/lobby');
  const stats = db.getUserStats(user.id);
  res.render('profile', { stats, profileUser: user.username });
});

module.exports = router;
