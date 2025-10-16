/**
 * Prefix Cache Model
 * Auto-fetching wrapper for prefix data using TTL cache system
 * Handles both guild prefixes and user self prefixes
 */
class Prefix {
  constructor() {
    // Get the cache instances from the unified interface
    const { guildCache, userCache } = require('../index');
    this.guildCache = guildCache;
    this.userCache = userCache;
  }

  // ===== GUILD PREFIX METHODS =====
  async getGuildPrefix(guildId) {
    const prefix = await this.guildCache.getField(guildId, 'Prefix');
    return prefix || ','; // Default prefix if null/undefined
  }

  async setGuildPrefix(guildId, prefix) {
    return await this.guildCache.setField(guildId, 'Prefix', prefix);
  }

  // ===== USER SELF PREFIX METHODS =====
  async getUserPrefix(userId) {
    return await this.userCache.getField(userId, 'SelfPrefix');
  }

  async setUserPrefix(userId, prefix) {
    return await this.userCache.setField(userId, 'SelfPrefix', prefix);
  }

  async clearUserPrefix(userId) {
    return await this.userCache.setField(userId, 'SelfPrefix', null);
  }

  // ===== PREFIX CHECKING METHODS =====
  /**
   * Check if message starts with valid prefix and return prefix info
   * @param {Message} message - Discord message object
   * @returns {Promise<Object|null>} Prefix info or null if no valid prefix
   */
  async checkPrefixes(message) {
    if (!message.content || !message.guild) return null;

    const content = message.content;
    const guildId = message.guild.id;
    const userId = message.author.id;

    // Get guild prefix
    const guildPrefix = await this.getGuildPrefix(guildId);
    
    // Get user self prefix
    const userPrefix = await this.getUserPrefix(userId);

    // Check user self prefix first (if exists)
    if (userPrefix && content.startsWith(userPrefix)) {
      return {
        prefix: userPrefix,
        type: 'user',
        content: content.slice(userPrefix.length).trim()
      };
    }

    // Check guild prefix
    if (content.startsWith(guildPrefix)) {
      return {
        prefix: guildPrefix,
        type: 'guild',
        content: content.slice(guildPrefix.length).trim()
      };
    }

    // Check mention prefix
    const mentionPrefix = `<@${message.client.user.id}>`;
    const mentionPrefixNick = `<@!${message.client.user.id}>`;
    
    if (content.startsWith(mentionPrefix)) {
      return {
        prefix: mentionPrefix,
        type: 'mention',
        content: content.slice(mentionPrefix.length).trim()
      };
    }
    
    if (content.startsWith(mentionPrefixNick)) {
      return {
        prefix: mentionPrefixNick,
        type: 'mention',
        content: content.slice(mentionPrefixNick.length).trim()
      };
    }

    return null;
  }

  /**
   * Get all valid prefixes for a guild/user combination
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID (optional)
   * @param {string} clientId - Bot client ID for mention prefix
   * @returns {Promise<Array>} Array of valid prefixes
   */
  async getAllPrefixes(guildId, userId = null, clientId = null) {
    const prefixes = [];

    // Guild prefix
    const guildPrefix = await this.getGuildPrefix(guildId);
    prefixes.push(guildPrefix);

    // User self prefix (if user ID provided)
    if (userId) {
      const userPrefix = await this.getUserPrefix(userId);
      if (userPrefix) {
        prefixes.push(userPrefix);
      }
    }

    // Mention prefixes (if client ID provided)
    if (clientId) {
      prefixes.push(`<@${clientId}>`);
      prefixes.push(`<@!${clientId}>`);
    }

    return prefixes;
  }

  /**
   * Format prefix for display (escape markdown)
   * @param {string} prefix - Prefix to format
   * @returns {string} Formatted prefix
   */
  formatPrefix(prefix) {
    if (!prefix) return ',';
    
    // Escape markdown characters
    return prefix.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
  }

  /**
   * Validate prefix format
   * @param {string} prefix - Prefix to validate
   * @returns {Object} Validation result
   */
  validatePrefix(prefix) {
    if (!prefix) {
      return { valid: false, error: 'Prefix cannot be empty' };
    }

    if (prefix.length > 10) {
      return { valid: false, error: 'Prefix cannot be longer than 10 characters' };
    }

    if (prefix.includes(' ')) {
      return { valid: false, error: 'Prefix cannot contain spaces' };
    }

    if (prefix.startsWith('<@')) {
      return { valid: false, error: 'Prefix cannot be a mention' };
    }

    return { valid: true };
  }
}

module.exports = new Prefix();
