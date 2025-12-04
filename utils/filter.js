const { getService } = require('../database/services');
const logger = require('./logger');

// Store message history per user per guild
// Structure: Map<guildId, Map<userId, Array<timestamp>>>
const messageHistory = new Map();

// Default settings
const SPAM_WINDOW = 5000; // Time window in milliseconds (5 seconds)
const CLEANUP_INTERVAL = 60000; // Clean up old data every 60 seconds

/**
 * Check if a message triggers spam filter
 * @param {Message} message - Discord message object
 * @returns {Promise<Object|null>} Filter data if spam detected, null otherwise
 */
async function checkSpamFilter(message) {
  try {
    const guildService = getService('guild');
    const guildData = await guildService.ensureGuildData(message.guild.id);

    // Check if spam filter is enabled
    const spamFilter = guildData.SpamFilter;
    if (!spamFilter || !spamFilter.enabled) {
      return null;
    }

    // Check if filter applies to this channel
    if (spamFilter.channels && spamFilter.channels.length > 0) {
      // Per-channel mode: only check if channel is in the list
      if (!spamFilter.channels.includes(message.channel.id)) {
        return null;
      }
    }

    // Check if user has exempt role
    if (spamFilter.exemptRoles && spamFilter.exemptRoles.length > 0) {
      const member = message.member;
      if (member && member.roles.cache.some(role => spamFilter.exemptRoles.includes(role.id))) {
        return null;
      }
    }

    // Check if user is admin/mod (always exempt)
    if (message.member && message.member.permissions.has('ManageMessages')) {
      return null;
    }

    // Get threshold (default: 5)
    const threshold = spamFilter.threshold || 5;

    // Track message history
    const guildId = message.guild.id;
    const userId = message.author.id;
    const now = Date.now();

    // Initialize guild map if needed
    if (!messageHistory.has(guildId)) {
      messageHistory.set(guildId, new Map());
    }

    const guildHistory = messageHistory.get(guildId);

    // Initialize user history if needed
    if (!guildHistory.has(userId)) {
      guildHistory.set(userId, []);
    }

    const userHistory = guildHistory.get(userId);

    // Remove messages outside the time window
    const recentMessages = userHistory.filter(timestamp => now - timestamp < SPAM_WINDOW);

    // Add current message
    recentMessages.push(now);

    // Update history
    guildHistory.set(userId, recentMessages);

    // Check if spam threshold exceeded
    if (recentMessages.length >= threshold) {
      return {
        type: 'spam',
        action: spamFilter.action || 'delete', // delete, mute, jail
        duration: spamFilter.duration || null, // for mute action
        threshold: threshold,
        messageCount: recentMessages.length
      };
    }

    return null;
  } catch (error) {
    logger.webhook.error(error, 'Spam Filter Check', {
      guild: message.guild?.name,
      user: message.author?.tag,
      channel: message.channel?.name
    });
    return null;
  }
}

/**
 * Clear spam history for a user (used after timeout/punishment)
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 */
function clearUserHistory(guildId, userId) {
  if (messageHistory.has(guildId)) {
    const guildHistory = messageHistory.get(guildId);
    guildHistory.delete(userId);
  }
}

/**
 * Clean up old message history data
 */
function cleanupHistory() {
  const now = Date.now();

  for (const [guildId, guildHistory] of messageHistory.entries()) {
    for (const [userId, userHistory] of guildHistory.entries()) {
      // Remove messages outside the time window
      const recentMessages = userHistory.filter(timestamp => now - timestamp < SPAM_WINDOW);

      if (recentMessages.length === 0) {
        // Remove user if no recent messages
        guildHistory.delete(userId);
      } else {
        // Update with filtered messages
        guildHistory.set(userId, recentMessages);
      }
    }

    // Remove guild if no users
    if (guildHistory.size === 0) {
      messageHistory.delete(guildId);
    }
  }
}

// Start cleanup interval
setInterval(cleanupHistory, CLEANUP_INTERVAL);

module.exports = {
  checkSpamFilter,
  clearUserHistory,
  SPAM_WINDOW
};
