const express = require('express');
const bcrypt = require('bcryptjs');
const { requireLogin } = require('../lib/auth');
const db = require('../lib/db');
const router = express.Router();

router.get('/account', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const user = db.findUserById(userId);
  const stats = db.getUserStats(userId);
  res.render('account', { stats, accountUser: user, error: null, success: null });
});

router.post('/account/change-password', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const user = db.findUserById(userId);
  const stats = db.getUserStats(userId);
  const { current_password, new_password, confirm_password } = req.body;

  if (!current_password || !new_password) {
    return res.render('account', { stats, accountUser: user, error: 'All fields are required', success: null });
  }

  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) {
    return res.render('account', { stats, accountUser: user, error: 'Current password is incorrect', success: null });
  }

  if (new_password.length < 4) {
    return res.render('account', { stats, accountUser: user, error: 'New password must be at least 4 characters', success: null });
  }

  if (new_password !== confirm_password) {
    return res.render('account', { stats, accountUser: user, error: 'New passwords do not match', success: null });
  }

  user.password_hash = await bcrypt.hash(new_password, 10);
  db.save();

  res.render('account', { stats, accountUser: user, error: null, success: 'Password changed successfully' });
});

module.exports = router;
