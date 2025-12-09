const { getService } = require('../database/services');
const logger = require('./logger');

// Store message history per user per guild
// Structure: Map<guildId, Map<userId, Array<{timestamp, messageId, channelId}>>>
const messageHistory = new Map();

// Store mention count per message
// Structure: Map<guildId, Map<userId, Array<{timestamp, mentionCount}>>>
const mentionHistory = new Map();

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

    // Check if channel is exempted
    if (spamFilter.exemptChannels && spamFilter.exemptChannels.includes(message.channel.id)) {
      return null;
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
    const recentMessages = userHistory.filter(entry => now - entry.timestamp < SPAM_WINDOW);

    // Add current message with ID for bulk deletion
    recentMessages.push({
      timestamp: now,
      messageId: message.id,
      channelId: message.channel.id
    });

    // Update history
    guildHistory.set(userId, recentMessages);

    // Check if spam threshold exceeded
    if (recentMessages.length >= threshold) {
      // Return all spam message IDs for bulk deletion
      return {
        type: 'spam',
        action: spamFilter.action || 'delete', // delete, mute, jail
        duration: spamFilter.duration || null, // for mute action
        threshold: threshold,
        messageCount: recentMessages.length,
        spamMessages: recentMessages.map(entry => ({
          messageId: entry.messageId,
          channelId: entry.channelId
        }))
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
 * Check if a message triggers mass mention filter
 * @param {Message} message - Discord message object
 * @returns {Promise<Object|null>} Filter data if mass mention detected, null otherwise
 */
async function checkMassMentionFilter(message) {
  try {
    const guildService = getService('guild');
    const guildData = await guildService.ensureGuildData(message.guild.id);

    // Check if mass mention filter is enabled
    const mentionFilter = guildData.MassMentionFilter;
    if (!mentionFilter || !mentionFilter.enabled) {
      return null;
    }

    // Check if filter applies to this channel
    if (mentionFilter.channels && mentionFilter.channels.length > 0) {
      if (!mentionFilter.channels.includes(message.channel.id)) {
        return null;
      }
    }

    // Check if channel is exempted
    if (mentionFilter.exemptChannels && mentionFilter.exemptChannels.includes(message.channel.id)) {
      return null;
    }

    // Check if user has exempt role
    if (mentionFilter.exemptRoles && mentionFilter.exemptRoles.length > 0) {
      const member = message.member;
      if (member && member.roles.cache.some(role => mentionFilter.exemptRoles.includes(role.id))) {
        return null;
      }
    }

    // Check if user is admin/mod (always exempt)
    if (message.member && message.member.permissions.has('ManageMessages')) {
      return null;
    }

    // Get threshold (default: 5)
    const threshold = mentionFilter.threshold || 5;

    // Count mentions in message (users + roles)
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;

    // Check if mention threshold exceeded
    if (mentionCount >= threshold) {
      return {
        type: 'massmention',
        action: mentionFilter.action || 'delete',
        duration: mentionFilter.duration || null,
        threshold: threshold,
        mentionCount: mentionCount
      };
    }

    return null;
  } catch (error) {
    logger.webhook.error(error, 'Mass Mention Filter Check', {
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
  if (mentionHistory.has(guildId)) {
    const guildMentionHistory = mentionHistory.get(guildId);
    guildMentionHistory.delete(userId);
  }
}

/**
 * Clean up old message history data
 */
function cleanupHistory() {
  const now = Date.now();

  // Clean spam history
  for (const [guildId, guildHistory] of messageHistory.entries()) {
    for (const [userId, userHistory] of guildHistory.entries()) {
      const recentMessages = userHistory.filter(entry => now - entry.timestamp < SPAM_WINDOW);

      if (recentMessages.length === 0) {
        guildHistory.delete(userId);
      } else {
        guildHistory.set(userId, recentMessages);
      }
    }

    if (guildHistory.size === 0) {
      messageHistory.delete(guildId);
    }
  }

  // Clean mention history
  for (const [guildId, guildMentionHistory] of mentionHistory.entries()) {
    for (const [userId, userMentionHistory] of guildMentionHistory.entries()) {
      const recentMentions = userMentionHistory.filter(entry => now - entry.timestamp < SPAM_WINDOW);

      if (recentMentions.length === 0) {
        guildMentionHistory.delete(userId);
      } else {
        guildMentionHistory.set(userId, recentMentions);
      }
    }

    if (guildMentionHistory.size === 0) {
      mentionHistory.delete(guildId);
    }
  }
}

// Start cleanup interval
setInterval(cleanupHistory, CLEANUP_INTERVAL);

module.exports = {
  checkSpamFilter,
  checkMassMentionFilter,
  clearUserHistory,
  SPAM_WINDOW
};
