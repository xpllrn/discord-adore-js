const { ValidationError } = require('../core/errors');

/**
 * Prefix Service
 * Orchestrates prefix resolution between Guild and User services
 * Provides unified prefix checking for command processing
 */
class PrefixService {
  constructor(guildService, userService = null) {
    this.guildService = guildService;
    this.userService = userService; // Will be null until UserService is implemented
    this.initialized = true;
  }

  /**
   * Resolve prefix from message
   * Checks user self-prefix, guild prefix, and mention prefixes
   * @param {Object} message - Discord message object
   * @returns {Promise<Object|null>} Prefix result or null if no valid prefix
   */
  async resolvePrefix(message) {
    if (!message || !message.content || !message.guild || !message.author) {
      return null;
    }

    const content = message.content;
    const guildId = message.guild.id;
    const userId = message.author.id;
    const clientId = message.client?.user?.id;

    try {
      // Check user self-prefix first (if UserService is available)
      if (this.userService) {
        const userPrefix = await this.getUserPrefix(userId);
        if (userPrefix && content.startsWith(userPrefix)) {
          return {
            prefix: userPrefix,
            type: 'user',
            content: content.slice(userPrefix.length).trim()
          };
        }
      }

      // Check guild prefix
      const guildPrefix = await this.getGuildPrefix(guildId);
      if (guildPrefix && content.startsWith(guildPrefix)) {
        return {
          prefix: guildPrefix,
          type: 'guild',
          content: content.slice(guildPrefix.length).trim()
        };
      }

      // Check mention prefixes (if client ID is available)
      if (clientId) {
        const mentionPrefix = `<@${clientId}>`;
        const mentionPrefixNick = `<@!${clientId}>`;
        
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
      }

      return null;
    } catch (error) {
      console.error('Error resolving prefix:', error.message);
      
      // Fallback to guild prefix only
      try {
        const guildPrefix = await this.getGuildPrefix(guildId);
        if (guildPrefix && content.startsWith(guildPrefix)) {
          return {
            prefix: guildPrefix,
            type: 'guild',
            content: content.slice(guildPrefix.length).trim()
          };
        }
      } catch (fallbackError) {
        console.error('Fallback prefix resolution failed:', fallbackError.message);
      }
      
      return null;
    }
  }

  /**
   * Get all valid prefixes for a guild/user combination
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID (optional)
   * @param {string} clientId - Bot client ID for mention prefix (optional)
   * @returns {Promise<string[]>} Array of valid prefixes
   */
  async getAllPrefixes(guildId, userId = null, clientId = null) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    const prefixes = [];

    try {
      // Guild prefix (always included)
      const guildPrefix = await this.getGuildPrefix(guildId);
      if (guildPrefix) {
        prefixes.push(guildPrefix);
      }

      // User self prefix (if user ID provided and UserService available)
      if (userId && this.userService) {
        try {
          const userPrefix = await this.getUserPrefix(userId);
          if (userPrefix) {
            prefixes.push(userPrefix);
          }
        } catch (error) {
          console.error(`Error getting user prefix for ${userId}:`, error.message);
        }
      }

      // Mention prefixes (if client ID provided)
      if (clientId) {
        prefixes.push(`<@${clientId}>`);
        prefixes.push(`<@!${clientId}>`);
      }

      return prefixes;
    } catch (error) {
      console.error('Error getting all prefixes:', error.message);
      return [',']; // Return default prefix on error
    }
  }

  /**
   * Get guild prefix
   * @param {string} guildId - Guild ID
   * @returns {Promise<string>} Guild prefix
   */
  async getGuildPrefix(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      return await this.guildService.getPrefix(guildId);
    } catch (error) {
      console.error(`Error getting guild prefix for ${guildId}:`, error.message);
      return ','; // Return default prefix on error
    }
  }

  /**
   * Set guild prefix
   * @param {string} guildId - Guild ID
   * @param {string} prefix - New prefix
   * @returns {Promise<boolean>} Success status
   */
  async setGuildPrefix(guildId, prefix) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      return await this.guildService.setPrefix(guildId, prefix);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error(`Error setting guild prefix for ${guildId}:`, error.message);
      return false;
    }
  }

  /**
   * Get user self prefix
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} User self prefix or null
   */
  async getUserPrefix(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!this.userService) {
      // UserService not available yet
      return null;
    }

    try {
      return await this.userService.getSelfPrefix(userId);
    } catch (error) {
      console.error(`Error getting user prefix for ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Set user self prefix
   * @param {string} userId - User ID
   * @param {string} prefix - New self prefix
   * @returns {Promise<boolean>} Success status
   */
  async setUserPrefix(userId, prefix) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!this.userService) {
      throw new Error('UserService not available - cannot set user prefix');
    }

    try {
      return await this.userService.setSelfPrefix(userId, prefix);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error(`Error setting user prefix for ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Clear user self prefix
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async clearUserPrefix(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!this.userService) {
      throw new Error('UserService not available - cannot clear user prefix');
    }

    try {
      return await this.userService.setSelfPrefix(userId, null);
    } catch (error) {
      console.error(`Error clearing user prefix for ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Validate prefix format
   * @param {string} prefix - Prefix to validate
   * @returns {Object} Validation result
   */
  validatePrefix(prefix) {
    return this.guildService.validatePrefix(prefix);
  }

  /**
   * Format prefix for display
   * @param {string} prefix - Prefix to format
   * @returns {string} Formatted prefix
   */
  formatPrefix(prefix) {
    return this.guildService.formatPrefix(prefix);
  }

  /**
   * Batch get prefixes for multiple guilds
   * @param {string[]} guildIds - Array of guild IDs
   * @returns {Promise<Map<string, string>>} Map of guild ID to prefix
   */
  async batchGetGuildPrefixes(guildIds) {
    if (!Array.isArray(guildIds)) {
      throw new ValidationError('Guild IDs must be an array', 'guildIds', guildIds);
    }

    try {
      return await this.guildService.batchGetPrefixes(guildIds);
    } catch (error) {
      console.error('Error batch getting guild prefixes:', error.message);
      
      // Return default prefixes for all guilds on error
      const defaultMap = new Map();
      for (const guildId of guildIds) {
        defaultMap.set(guildId, ',');
      }
      return defaultMap;
    }
  }

  /**
   * Check if message starts with any valid prefix
   * @param {Object} message - Discord message object
   * @returns {Promise<boolean>} True if message starts with valid prefix
   */
  async hasValidPrefix(message) {
    const result = await this.resolvePrefix(message);
    return result !== null;
  }

  /**
   * Get prefix type priority order
   * @returns {string[]} Array of prefix types in priority order
   */
  getPrefixPriority() {
    return ['user', 'guild', 'mention'];
  }

  /**
   * Check if prefix type is available
   * @param {string} type - Prefix type ('user', 'guild', 'mention')
   * @returns {boolean} True if prefix type is available
   */
  isPrefixTypeAvailable(type) {
    switch (type) {
      case 'guild':
        return this.guildService !== null;
      case 'user':
        return this.userService !== null;
      case 'mention':
        return true; // Always available
      default:
        return false;
    }
  }

  /**
   * Get service health status
   * @returns {Object} Health status
   */
  getHealth() {
    return {
      initialized: this.initialized,
      guildService: this.guildService !== null,
      userService: this.userService !== null,
      availablePrefixTypes: ['user', 'guild', 'mention'].filter(type => 
        this.isPrefixTypeAvailable(type)
      )
    };
  }

  /**
   * Update UserService reference (called when UserService becomes available)
   * @param {Object} userService - UserService instance
   */
  setUserService(userService) {
    this.userService = userService;
  }

  /**
   * Get prefix statistics
   * @returns {Object} Prefix service statistics
   */
  getStats() {
    return {
      serviceName: 'PrefixService',
      initialized: this.initialized,
      guildServiceAvailable: this.guildService !== null,
      userServiceAvailable: this.userService !== null,
      supportedPrefixTypes: this.getPrefixPriority(),
      availablePrefixTypes: ['user', 'guild', 'mention'].filter(type => 
        this.isPrefixTypeAvailable(type)
      )
    };
  }
}

module.exports = PrefixService;