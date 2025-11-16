/**
 * ConfessionService
 * Manages confession system for guilds
 */

const BaseService = require('../core/BaseService');

class ConfessionService extends BaseService {
  constructor() {
    super('Confession');
    this.initialized = true;
  }

  /**
   * Get confession configuration for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Confession config
   */
  async getConfessionConfig(guildId) {
    const guildData = await this.getGuildService().ensureGuildData(guildId);
    const confessionSystem = guildData.ConfessionSystem || {};
    
    // Ensure all fields have default values
    return {
      enabled: confessionSystem.enabled || false,
      channelId: confessionSystem.channelId || null,
      ignoredUsers: confessionSystem.ignoredUsers || [],
      nextConfessionId: confessionSystem.nextConfessionId || 1
    };
  }

  /**
   * Set confession channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<void>}
   */
  async setConfessionChannel(guildId, channelId) {
    await this.getGuildService().setGuildField(guildId, 'ConfessionSystem.channelId', channelId);
    await this.getGuildService().setGuildField(guildId, 'ConfessionSystem.enabled', true);
  }

  /**
   * Add ignored user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID to ignore
   * @returns {Promise<void>}
   */
  async addIgnoredUser(guildId, userId) {
    const config = await this.getConfessionConfig(guildId);
    if (!config.ignoredUsers.includes(userId)) {
      config.ignoredUsers.push(userId);
      await this.getGuildService().setGuildField(guildId, 'ConfessionSystem.ignoredUsers', config.ignoredUsers);
    }
  }

  /**
   * Remove ignored user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID to unignore
   * @returns {Promise<void>}
   */
  async removeIgnoredUser(guildId, userId) {
    const config = await this.getConfessionConfig(guildId);
    const index = config.ignoredUsers.indexOf(userId);
    if (index > -1) {
      config.ignoredUsers.splice(index, 1);
      await this.getGuildService().setGuildField(guildId, 'ConfessionSystem.ignoredUsers', config.ignoredUsers);
    }
  }

  /**
   * Check if user is ignored
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async isUserIgnored(guildId, userId) {
    const config = await this.getConfessionConfig(guildId);
    return config.ignoredUsers.includes(userId);
  }

  /**
   * Get next confession ID and increment
   * @param {string} guildId - Guild ID
   * @returns {Promise<number>}
   */
  async getNextConfessionId(guildId) {
    const config = await this.getConfessionConfig(guildId);
    const confessionId = config.nextConfessionId || 1;
    await this.getGuildService().setGuildField(guildId, 'ConfessionSystem.nextConfessionId', confessionId + 1);
    return confessionId;
  }

  /**
   * Get guild service instance
   * @returns {Object} GuildService
   */
  getGuildService() {
    const { getService } = require('@services');
    return getService('guild');
  }
}

module.exports = ConfessionService;
