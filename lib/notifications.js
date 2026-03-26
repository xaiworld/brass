/**
 * Web Push Notifications for Brass: Lancashire.
 * Sends notifications when:
 * - It's a player's turn
 * - A game starts
 * - A game finishes
 */

const webpush = require('web-push');
const db = require('./db');

// VAPID keys for push notifications
const VAPID_PUBLIC = 'BPijKj6R68SKZd_jDiVw-YXgMVquAE4Kl7vbhg25vWKWXY_6Etv7K8R2FRjlnkiCB4o-uyMJE3M0rxtBIMDnVTw';
const VAPID_PRIVATE = 'VLQwhJVMqoDcYKzJ4gtalzOJT2Eq9daU56_NCSDsAC4';

webpush.setVapidDetails('mailto:brass@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

/**
 * Send push notification to a user.
 * @param {number} userId
 * @param {object} payload - { title, body, url, tag, requireInteraction }
 */
function sendToUser(userId, payload) {
  const subs = db.getPushSubscriptions(userId);
  if (!subs || subs.length === 0) return;

  const data = JSON.stringify(payload);
  for (const sub of subs) {
    try {
      const subscription = JSON.parse(sub.subscription);
      webpush.sendNotification(subscription, data).catch(err => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired, remove it
          db.removePushSubscription(sub.id);
        }
      });
    } catch (e) {
      // Invalid subscription, skip
    }
  }
}

/**
 * Notify a player it's their turn.
 */
function notifyYourTurn(gameId, gameName, userId, username) {
  sendToUser(userId, {
    title: 'Your Turn!',
    body: `It's your turn in "${gameName}"`,
    url: '/games/' + gameId,
    tag: 'turn-' + gameId,
    requireInteraction: true,
  });
}

/**
 * Notify all human players that a game has started.
 */
function notifyGameStarted(gameId, gameName, playerUserIds) {
  for (const userId of playerUserIds) {
    sendToUser(userId, {
      title: 'Game Started!',
      body: `"${gameName}" has begun`,
      url: '/games/' + gameId,
      tag: 'start-' + gameId,
    });
  }
}

/**
 * Notify all human players that a game has finished.
 */
function notifyGameFinished(gameId, gameName, playerUserIds, winnerName) {
  for (const userId of playerUserIds) {
    sendToUser(userId, {
      title: 'Game Over!',
      body: `"${gameName}" finished — ${winnerName} wins!`,
      url: '/games/' + gameId,
      tag: 'end-' + gameId,
    });
  }
}

module.exports = { VAPID_PUBLIC, sendToUser, notifyYourTurn, notifyGameStarted, notifyGameFinished };
