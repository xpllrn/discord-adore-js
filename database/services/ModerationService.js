const BaseService = require('./core/BaseService');
const { model: Guild } = require('../models/guild');

/**
 * ModerationService
 * Handles moderation cases and history
 */
class ModerationService extends BaseService {
  constructor() {
    super('ModerationService');
  }

  /**
   * Add a moderation case
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID being moderated
   * @param {string} moderatorId - Moderator ID
   * @param {string} action - Action type (warn, mute, kick, ban, etc.)
   * @param {string} reason - Reason for action
   * @param {string} duration - Duration (optional)
   * @returns {Promise<Object>} Created case
   */
  async addModerationCase(guildId, userId, moderatorId, action, reason, duration = null) {
    return this.executeWithRetry(async () => {
      const guild = await Guild.findOne({ GuildID: guildId });
      
      if (!guild) {
        // Create guild if it doesn't exist
        const newGuild = new Guild({
          GuildID: guildId,
          Moderation: []
        });
        await newGuild.save();
        return this.addModerationCase(guildId, userId, moderatorId, action, reason, duration);
      }

      // Get next case ID
      const caseId = guild.Moderation.length > 0 
        ? Math.max(...guild.Moderation.map(c => c.caseId)) + 1 
        : 1;

      const moderationCase = {
        caseId,
        userId,
        moderatorId,
        action,
        reason,
        duration,
        timestamp: new Date()
      };

      guild.Moderation.push(moderationCase);
      await guild.save();

      return moderationCase;
    });
  }

  /**
   * Get moderation cases for a user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {string} action - Filter by action type (optional)
   * @returns {Promise<Array>} Array of cases
   */
  async getUserCases(guildId, userId, action = null) {
    return this.executeWithRetry(async () => {
      const guild = await Guild.findOne({ GuildID: guildId });
      
      if (!guild || !guild.Moderation) {
        return [];
      }

      let cases = guild.Moderation.filter(c => c.userId === userId);
      
      if (action) {
        cases = cases.filter(c => c.action === action);
      }

      return cases.sort((a, b) => b.timestamp - a.timestamp);
    });
  }

  /**
   * Get a specific case by ID
   * @param {string} guildId - Guild ID
   * @param {number} caseId - Case ID
   * @returns {Promise<Object|null>} Case or null
   */
  async getCase(guildId, caseId) {
    return this.executeWithRetry(async () => {
      const guild = await Guild.findOne({ GuildID: guildId });
      
      if (!guild || !guild.Moderation) {
        return null;
      }

      return guild.Moderation.find(c => c.caseId === caseId) || null;
    });
  }

  /**
   * Get all moderation cases for a guild
   * @param {string} guildId - Guild ID
   * @param {number} limit - Limit results (optional)
   * @returns {Promise<Array>} Array of cases
   */
  async getAllCases(guildId, limit = null) {
    return this.executeWithRetry(async () => {
      const guild = await Guild.findOne({ GuildID: guildId });
      
      if (!guild || !guild.Moderation) {
        return [];
      }

      let cases = [...guild.Moderation].sort((a, b) => b.timestamp - a.timestamp);
      
      if (limit) {
        cases = cases.slice(0, limit);
      }

      return cases;
    });
  }

  /**
   * Get cases by moderator
   * @param {string} guildId - Guild ID
   * @param {string} moderatorId - Moderator ID
   * @returns {Promise<Array>} Array of cases
   */
  async getModeratorCases(guildId, moderatorId) {
    return this.executeWithRetry(async () => {
      const guild = await Guild.findOne({ GuildID: guildId });
      
      if (!guild || !guild.Moderation) {
        return [];
      }

      return guild.Moderation
        .filter(c => c.moderatorId === moderatorId)
        .sort((a, b) => b.timestamp - a.timestamp);
    });
  }

  /**
   * Delete a moderation case
   * @param {string} guildId - Guild ID
   * @param {number} caseId - Case ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteCase(guildId, caseId) {
    return this.executeWithRetry(async () => {
      const guild = await Guild.findOne({ GuildID: guildId });
      
      if (!guild || !guild.Moderation) {
        return false;
      }

      const initialLength = guild.Moderation.length;
      guild.Moderation = guild.Moderation.filter(c => c.caseId !== caseId);
      
      if (guild.Moderation.length < initialLength) {
        await guild.save();
        return true;
      }

      return false;
    });
  }

  /**
   * Get warning count for a user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<number>} Warning count
   */
  async getWarningCount(guildId, userId) {
    return this.executeWithRetry(async () => {
      const guild = await Guild.findOne({ GuildID: guildId });
      
      if (!guild || !guild.Moderation) {
        return 0;
      }

      return guild.Moderation.filter(c => 
        c.userId === userId && c.action === 'warn'
      ).length;
    });
  }

  /**
   * Clear all warnings for a user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of warnings cleared
   */
  async clearWarnings(guildId, userId) {
    return this.executeWithRetry(async () => {
      const guild = await Guild.findOne({ GuildID: guildId });
      
      if (!guild || !guild.Moderation) {
        return 0;
      }

      const initialLength = guild.Moderation.filter(c => 
        c.userId === userId && c.action === 'warn'
      ).length;

      guild.Moderation = guild.Moderation.filter(c => 
        !(c.userId === userId && c.action === 'warn')
      );

      await guild.save();
      return initialLength;
    });
  }

  /**
   * Get moderation statistics for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Statistics
   */
  async getStats(guildId) {
    return this.executeWithRetry(async () => {
      const guild = await Guild.findOne({ GuildID: guildId });
      
      if (!guild || !guild.Moderation) {
        return {
          total: 0,
          byAction: {},
          uniqueUsers: 0,
          uniqueModerators: 0
        };
      }

      const cases = guild.Moderation;
      const byAction = {};
      const uniqueUsers = new Set();
      const uniqueModerators = new Set();

      cases.forEach(c => {
        byAction[c.action] = (byAction[c.action] || 0) + 1;
        uniqueUsers.add(c.userId);
        uniqueModerators.add(c.moderatorId);
      });

      return {
        total: cases.length,
        byAction,
        uniqueUsers: uniqueUsers.size,
        uniqueModerators: uniqueModerators.size
      };
    });
  }
}

module.exports = ModerationService;
