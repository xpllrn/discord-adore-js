const BaseService = require('./core/BaseService');
const { ValidationError, NotFoundError, DatabaseWriteError } = require('./core/errors');

/**
 * Guild Service
 * Handles all guild-related data operations with intelligent caching
 */
class GuildService extends BaseService {
  constructor() {
    super({
      modelName: 'Guild',
      keyField: 'GuildID',
      database: 'local',
      ttl: 60 * 60 * 1000, // 1 hour TTL for guild data
      maxSize: 5000 // Max 5000 guilds in cache
    });
    
    this.initialized = true;
  }

  // ===== DATABASE OPERATIONS (BaseService Implementation) =====

  /**
   * Write guild data to database
   * @param {string} key - Guild ID
   * @param {Object} data - Guild data
   * @returns {Promise<void>}
   */
  async writeToDatabase(key, data) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      // Remove _id from data to prevent duplicate key errors
      const updateData = { ...data };
      delete updateData._id;

      await Model.updateOne(query, { $set: updateData }, { upsert: true });
    } catch (error) {
      throw new DatabaseWriteError(`Failed to write guild data for ${key}`, error);
    }
  }

  /**
   * Read guild data from database
   * @param {string} key - Guild ID
   * @returns {Promise<Object|null>} Guild data or null
   */
  async readFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      const doc = await Model.findOne(query).lean();
      return doc || null;
    } catch (error) {
      console.error(`Error reading guild data for ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Delete guild data from database
   * @param {string} key - Guild ID
   * @returns {Promise<void>}
   */
  async deleteFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      await Model.deleteOne(query);
    } catch (error) {
      throw new DatabaseWriteError(`Failed to delete guild data for ${key}`, error);
    }
  }

  /**
   * Batch read guild data from database
   * @param {string[]} keys - Array of guild IDs
   * @returns {Promise<Map<string, Object>>} Map of guild ID to guild data
   */
  async batchReadFromDatabase(keys) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: { $in: keys } };

      const docs = await Model.find(query).lean();
      const result = new Map();

      for (const doc of docs) {
        result.set(doc[this.keyField], doc);
      }

      return result;
    } catch (error) {
      console.error('Error batch reading guild data:', error.message);
      return new Map();
    }
  }

  // ===== GUILD DATA OPERATIONS =====

  /**
   * Ensure guild data exists with default values
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Guild data
   */
  async ensureGuildData(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      // Try to get existing data first
      let guildData = await this.get(guildId);

      if (!guildData) {
        // Create default guild data
        guildData = {
          GuildID: guildId,
          Prefix: ',', // Default prefix
          // Initialize other default fields as needed
          WelcomeChannel: null,
          WelcomeMessage: null,
          LeaveChannel: null,
          LeaveMessage: null,
          BoostChannel: null,
          BoostMessage: null,
          BoostRole: null,
          Vanity: null,
          VanityRoles: [],
          VanityMessage: null,
          VanityLogChannel: null,
          JailRoleID: null,
          JailChannelID: null,
          AFK: [],
          ForceNick: [],
          AutoRoles: [],
          AutoReact: [],
          AutoResponder: [],
          Moderation: [],
          MessageStats: [],
          SwearTracker: [],
          Reminders: [],
          GuildNameHistory: [],
          StarboardChannel: null,
          StarboardThreshold: 3,
          StarboardEmoji: '⭐',
          StarboardMessages: [],
          VoiceManager: {
            enabled: false,
            categoryId: null,
            joinChannelId: null,
            mutedChannelId: null,
            tempChannels: []
          },
          LastFMCrowns: [],
          TicketSystem: {
            enabled: false,
            categoryId: null,
            supportRoleId: null,
            setupChannelId: null,
            setupMessageId: null,
            activeTickets: [],
            ticketCounter: 0
          },
          LoggingConfig: [],
          LevelSystem: {
            enabled: false,
            messageMode: 'context',
            levelUpChannel: null,
            levelRoles: [],
            lastSyncTime: null
          },
          UserLevels: [],
          StickyMessages: [],
          ScheduledNukes: [],
          PojMessages: [],
          WelcomeMessages: [],
          LeaveMessages: [],
          BoostMessages: [],
          Giveaways: [],
          BoosterRoleSystem: {
            baseRoleId: null,
            enabled: false
          },
          BoosterRoles: [],
          BoostHistory: [],
          AutopostChannels: [],
          VanityDisabled: false,
          Counting: {
            channelId: null,
            currentNumber: 0,
            lastUserId: null
          }
        };

        // Save to database and cache
        await this.set(guildId, guildData);
      }

      return guildData;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to ensure guild data for ${guildId}`, error);
    }
  }

  // ===== PREFIX OPERATIONS =====

  /**
   * Get guild prefix
   * @param {string} guildId - Guild ID
   * @returns {Promise<string>} Guild prefix (default: ',')
   */
  async getPrefix(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.Prefix || ',';
    } catch (error) {
      console.error(`Error getting prefix for guild ${guildId}:`, error.message);
      return ','; // Return default prefix on error
    }
  }

  /**
   * Set guild prefix with validation
   * @param {string} guildId - Guild ID
   * @param {string} prefix - New prefix
   * @returns {Promise<boolean>} Success status
   */
  async setPrefix(guildId, prefix) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    // Validate prefix
    const validation = this.validatePrefix(prefix);
    if (!validation.valid) {
      throw new ValidationError(validation.error, 'prefix', prefix);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.Prefix = prefix;
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set prefix for guild ${guildId}`, error);
    }
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

    if (typeof prefix !== 'string') {
      return { valid: false, error: 'Prefix must be a string' };
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

    // Check for problematic characters
    const problematicChars = ['`', '\\', '\n', '\r', '\t'];
    for (const char of problematicChars) {
      if (prefix.includes(char)) {
        return { valid: false, error: 'Prefix contains invalid characters' };
      }
    }

    return { valid: true };
  }

  /**
   * Format prefix for display (escape markdown)
   * @param {string} prefix - Prefix to format
   * @returns {string} Formatted prefix
   */
  formatPrefix(prefix) {
    if (!prefix) return ',';
    
    // Escape markdown characters for display
    return prefix.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
  }

  // ===== BATCH OPERATIONS =====

  /**
   * Batch get prefixes for multiple guilds
   * @param {string[]} guildIds - Array of guild IDs
   * @returns {Promise<Map<string, string>>} Map of guild ID to prefix
   */
  async batchGetPrefixes(guildIds) {
    if (!Array.isArray(guildIds) || guildIds.length === 0) {
      return new Map();
    }

    try {
      // Use the cache-first batch operation from BaseService
      const guildDataMap = await this.batchGet(guildIds);
      const prefixMap = new Map();

      for (const guildId of guildIds) {
        const guildData = guildDataMap.get(guildId);
        const prefix = guildData?.Prefix || ',';
        prefixMap.set(guildId, prefix);
      }

      return prefixMap;
    } catch (error) {
      console.error('Error batch getting prefixes:', error.message);
      
      // Return default prefixes for all guilds on error
      const defaultMap = new Map();
      for (const guildId of guildIds) {
        defaultMap.set(guildId, ',');
      }
      return defaultMap;
    }
  }

  /**
   * Batch update guild settings
   * @param {Object} updates - Object with guildId as key and update data as value
   * @returns {Promise<boolean>} Success status
   */
  async batchUpdateSettings(updates) {
    if (!updates || typeof updates !== 'object') {
      throw new ValidationError('Updates object is required', 'updates', updates);
    }

    try {
      const updatePromises = [];

      for (const [guildId, updateData] of Object.entries(updates)) {
        updatePromises.push(
          this.updateGuildData(guildId, updateData).catch(error => {
            console.error(`Error updating guild ${guildId}:`, error.message);
            return false;
          })
        );
      }

      const results = await Promise.all(updatePromises);
      return results.every(result => result === true);
    } catch (error) {
      throw new DatabaseWriteError('Failed to batch update guild settings', error);
    }
  }

  /**
   * Update guild data with partial updates
   * @param {string} guildId - Guild ID
   * @param {Object} updates - Partial update data
   * @returns {Promise<boolean>} Success status
   */
  async updateGuildData(guildId, updates) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!updates || typeof updates !== 'object') {
      throw new ValidationError('Updates object is required', 'updates', updates);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      
      // Apply updates
      Object.assign(guildData, updates);
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update guild data for ${guildId}`, error);
    }
  }

  /**
   * Get guild field value
   * @param {string} guildId - Guild ID
   * @param {string} field - Field name
   * @returns {Promise<*>} Field value
   */
  async getGuildField(guildId, field) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!field) {
      throw new ValidationError('Field name is required', 'field', field);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      
      // Handle nested paths (e.g., "Welcome.channelId")
      const fieldParts = field.split('.');
      if (fieldParts.length > 1) {
        let current = guildData;
        for (const part of fieldParts) {
          if (current === null || current === undefined) {
            return null;
          }
          current = current[part];
        }
        return current;
      }
      
      return guildData[field];
    } catch (error) {
      console.error(`Error getting field ${field} for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Set guild field value
   * @param {string} guildId - Guild ID
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @returns {Promise<boolean>} Success status
   */
  async setGuildField(guildId, field, value) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!field) {
      throw new ValidationError('Field name is required', 'field', field);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      
      // Handle nested paths (e.g., "Welcome.channelId")
      const fieldParts = field.split('.');
      if (fieldParts.length > 1) {
        let current = guildData;
        for (let i = 0; i < fieldParts.length - 1; i++) {
          if (!current[fieldParts[i]]) {
            current[fieldParts[i]] = {};
          }
          current = current[fieldParts[i]];
        }
        current[fieldParts[fieldParts.length - 1]] = value;
      } else {
        guildData[field] = value;
      }
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set field ${field} for guild ${guildId}`, error);
    }
  }

  // ===== WELCOME SYSTEM =====

  /**
   * Get welcome settings
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Welcome settings
   */
  async getWelcomeSettings(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return {
        channelId: guildData.WelcomeChannel,
        message: guildData.WelcomeMessage,
        enabled: !!(guildData.WelcomeChannel && guildData.WelcomeMessage)
      };
    } catch (error) {
      console.error(`Error getting welcome settings for guild ${guildId}:`, error.message);
      return { channelId: null, message: null, enabled: false };
    }
  }

  /**
   * Set welcome settings
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Welcome channel ID
   * @param {string} message - Welcome message
   * @returns {Promise<boolean>} Success status
   */
  async setWelcomeSettings(guildId, channelId, message) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!message || message.trim().length === 0) {
      throw new ValidationError('Welcome message is required', 'message', message);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.WelcomeChannel = channelId;
      guildData.WelcomeMessage = message.trim();
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set welcome settings for guild ${guildId}`, error);
    }
  }

  /**
   * Remove welcome settings
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async removeWelcomeSettings(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.WelcomeChannel = null;
      guildData.WelcomeMessage = null;
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to remove welcome settings for guild ${guildId}`, error);
    }
  }

  // ===== LEAVE SYSTEM =====

  /**
   * Get leave settings
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Leave settings
   */
  async getLeaveSettings(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return {
        channelId: guildData.LeaveChannel,
        message: guildData.LeaveMessage,
        enabled: !!(guildData.LeaveChannel && guildData.LeaveMessage)
      };
    } catch (error) {
      console.error(`Error getting leave settings for guild ${guildId}:`, error.message);
      return { channelId: null, message: null, enabled: false };
    }
  }

  /**
   * Set leave settings
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Leave channel ID
   * @param {string} message - Leave message
   * @returns {Promise<boolean>} Success status
   */
  async setLeaveSettings(guildId, channelId, message) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!message || message.trim().length === 0) {
      throw new ValidationError('Leave message is required', 'message', message);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.LeaveChannel = channelId;
      guildData.LeaveMessage = message.trim();
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set leave settings for guild ${guildId}`, error);
    }
  }

  /**
   * Remove leave settings
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async removeLeaveSettings(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.LeaveChannel = null;
      guildData.LeaveMessage = null;
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to remove leave settings for guild ${guildId}`, error);
    }
  }

  // ===== BOOST SYSTEM =====

  /**
   * Get boost settings
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Boost settings
   */
  async getBoostSettings(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return {
        channelId: guildData.BoostChannel,
        message: guildData.BoostMessage,
        roleId: guildData.BoostRole,
        enabled: !!(guildData.BoostChannel && guildData.BoostMessage)
      };
    } catch (error) {
      console.error(`Error getting boost settings for guild ${guildId}:`, error.message);
      return { channelId: null, message: null, roleId: null, enabled: false };
    }
  }

  /**
   * Set boost settings
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Boost channel ID
   * @param {string} message - Boost message
   * @param {string} roleId - Optional boost role ID
   * @returns {Promise<boolean>} Success status
   */
  async setBoostSettings(guildId, channelId, message, roleId = null) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!message || message.trim().length === 0) {
      throw new ValidationError('Boost message is required', 'message', message);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.BoostChannel = channelId;
      guildData.BoostMessage = message.trim();
      guildData.BoostRole = roleId;
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set boost settings for guild ${guildId}`, error);
    }
  }

  /**
   * Remove boost settings
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async removeBoostSettings(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.BoostChannel = null;
      guildData.BoostMessage = null;
      guildData.BoostRole = null;
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to remove boost settings for guild ${guildId}`, error);
    }
  }

  // ===== VANITY SYSTEM =====

  /**
   * Get vanity settings
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Vanity settings
   */
  async getVanitySettings(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return {
        vanityText: guildData.Vanity,
        roles: guildData.VanityRoles || [],
        message: guildData.VanityMessage,
        logChannelId: guildData.VanityLogChannel,
        disabled: guildData.VanityDisabled || false,
        enabled: !!(guildData.Vanity && !guildData.VanityDisabled)
      };
    } catch (error) {
      console.error(`Error getting vanity settings for guild ${guildId}:`, error.message);
      return { vanityText: null, roles: [], message: null, logChannelId: null, disabled: false, enabled: false };
    }
  }

  /**
   * Set vanity settings
   * @param {string} guildId - Guild ID
   * @param {string} vanityText - Vanity text
   * @param {string[]} roles - Array of role IDs
   * @param {string} logChannelId - Optional log channel ID
   * @param {string} message - Optional log message
   * @returns {Promise<boolean>} Success status
   */
  async setVanitySettings(guildId, vanityText, roles = [], logChannelId = null, message = null) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!vanityText || vanityText.trim().length === 0) {
      throw new ValidationError('Vanity text is required', 'vanityText', vanityText);
    }

    if (!Array.isArray(roles)) {
      throw new ValidationError('Roles must be an array', 'roles', roles);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.Vanity = vanityText.trim();
      guildData.VanityRoles = roles;
      guildData.VanityLogChannel = logChannelId;
      guildData.VanityMessage = message;
      guildData.VanityDisabled = false;
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set vanity settings for guild ${guildId}`, error);
    }
  }

  /**
   * Disable vanity system
   * @param {string} guildId - Guild ID
   * @param {string} reason - Reason for disabling
   * @returns {Promise<boolean>} Success status
   */
  async disableVanity(guildId, reason = 'Disabled by administrator') {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.VanityDisabled = true;
      guildData.VanityDisabledReason = reason;
      guildData.VanityDisabledAt = new Date();
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to disable vanity for guild ${guildId}`, error);
    }
  }

  // ===== JAIL SYSTEM =====

  /**
   * Get jail settings
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Jail settings
   */
  async getJailSettings(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return {
        roleId: guildData.JailRoleID,
        channelId: guildData.JailChannelID,
        enabled: !!(guildData.JailRoleID && guildData.JailChannelID)
      };
    } catch (error) {
      console.error(`Error getting jail settings for guild ${guildId}:`, error.message);
      return { roleId: null, channelId: null, enabled: false };
    }
  }

  /**
   * Set jail settings
   * @param {string} guildId - Guild ID
   * @param {string} roleId - Jail role ID
   * @param {string} channelId - Jail channel ID
   * @returns {Promise<boolean>} Success status
   */
  async setJailSettings(guildId, roleId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!roleId) {
      throw new ValidationError('Jail role ID is required', 'roleId', roleId);
    }

    if (!channelId) {
      throw new ValidationError('Jail channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.JailRoleID = roleId;
      guildData.JailChannelID = channelId;
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set jail settings for guild ${guildId}`, error);
    }
  }

  // ===== AUTO ROLES =====

  /**
   * Get auto roles
   * @param {string} guildId - Guild ID
   * @returns {Promise<string[]>} Array of role IDs
   */
  async getAutoRoles(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.AutoRoles || [];
    } catch (error) {
      console.error(`Error getting auto roles for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Add auto role
   * @param {string} guildId - Guild ID
   * @param {string} roleId - Role ID to add
   * @returns {Promise<boolean>} Success status
   */
  async addAutoRole(guildId, roleId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!roleId) {
      throw new ValidationError('Role ID is required', 'roleId', roleId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const autoRoles = guildData.AutoRoles || [];
      
      if (!autoRoles.includes(roleId)) {
        autoRoles.push(roleId);
        guildData.AutoRoles = autoRoles;
        await this.set(guildId, guildData);
      }
      
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add auto role for guild ${guildId}`, error);
    }
  }

  /**
   * Remove auto role
   * @param {string} guildId - Guild ID
   * @param {string} roleId - Role ID to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeAutoRole(guildId, roleId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!roleId) {
      throw new ValidationError('Role ID is required', 'roleId', roleId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const autoRoles = guildData.AutoRoles || [];
      
      guildData.AutoRoles = autoRoles.filter(id => id !== roleId);
      await this.set(guildId, guildData);
      
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove auto role for guild ${guildId}`, error);
    }
  }

  /**
   * Clear all auto roles
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async clearAutoRoles(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.AutoRoles = [];
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to clear auto roles for guild ${guildId}`, error);
    }
  }

  // ===== COUNTING SYSTEM =====

  /**
   * Get counting settings
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Counting settings
   */
  async getCountingSettings(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.Counting || {
        channelId: null,
        currentNumber: 0,
        lastUserId: null
      };
    } catch (error) {
      console.error(`Error getting counting settings for guild ${guildId}:`, error.message);
      return { channelId: null, currentNumber: 0, lastUserId: null };
    }
  }

  /**
   * Set counting channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Counting channel ID
   * @returns {Promise<boolean>} Success status
   */
  async setCountingChannel(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.Counting = {
        channelId: channelId,
        currentNumber: 0,
        lastUserId: null
      };
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set counting channel for guild ${guildId}`, error);
    }
  }

  /**
   * Update counting progress
   * @param {string} guildId - Guild ID
   * @param {number} number - Current number
   * @param {string} userId - User ID who counted
   * @returns {Promise<boolean>} Success status
   */
  async updateCountingProgress(guildId, number, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof number !== 'number' || number < 0) {
      throw new ValidationError('Number must be a positive number', 'number', number);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      if (!guildData.Counting) {
        guildData.Counting = { channelId: null, currentNumber: 0, lastUserId: null };
      }
      
      guildData.Counting.currentNumber = number;
      guildData.Counting.lastUserId = userId;
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update counting progress for guild ${guildId}`, error);
    }
  }

  // ===== MODERATION SYSTEM =====

  /**
   * Get moderation history for a user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {string} action - Optional action filter
   * @returns {Promise<Object[]>} Array of moderation cases
   */
  async getModerationHistory(guildId, userId, action = null) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      let moderationHistory = (guildData.Moderation || []).filter(mod => mod.userId === userId);

      if (action) {
        moderationHistory = moderationHistory.filter(mod => mod.action === action);
      }

      // Sort by timestamp descending (newest first)
      return moderationHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error(`Error getting moderation history for user ${userId} in guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Add moderation case
   * @param {string} guildId - Guild ID
   * @param {Object} caseData - Moderation case data
   * @param {string} caseData.userId - User ID being moderated
   * @param {string} caseData.moderatorId - Moderator ID
   * @param {string} caseData.action - Moderation action
   * @param {string} caseData.reason - Reason for action
   * @param {string} caseData.duration - Optional duration
   * @returns {Promise<Object>} Created moderation case
   */
  async addModerationCase(guildId, caseData) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!caseData || typeof caseData !== 'object') {
      throw new ValidationError('Case data is required', 'caseData', caseData);
    }

    const { userId, moderatorId, action, reason, duration = null } = caseData;

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!moderatorId) {
      throw new ValidationError('Moderator ID is required', 'moderatorId', moderatorId);
    }

    if (!action) {
      throw new ValidationError('Action is required', 'action', action);
    }

    if (!reason) {
      throw new ValidationError('Reason is required', 'reason', reason);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const moderation = guildData.Moderation || [];

      // Get next case ID
      const nextCaseId = moderation.length > 0 
        ? Math.max(...moderation.map(c => c.caseId)) + 1 
        : 1;

      const moderationCase = {
        caseId: nextCaseId,
        userId,
        moderatorId,
        action,
        reason,
        duration,
        timestamp: new Date()
      };

      moderation.push(moderationCase);
      guildData.Moderation = moderation;
      
      await this.set(guildId, guildData);
      return moderationCase;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add moderation case for guild ${guildId}`, error);
    }
  }

  /**
   * Get moderation case by case ID
   * @param {string} guildId - Guild ID
   * @param {number} caseId - Case ID
   * @returns {Promise<Object|null>} Moderation case or null
   */
  async getModerationCase(guildId, caseId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof caseId !== 'number' || caseId < 1) {
      throw new ValidationError('Valid case ID is required', 'caseId', caseId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const moderation = guildData.Moderation || [];
      
      return moderation.find(mod => mod.caseId === caseId) || null;
    } catch (error) {
      console.error(`Error getting moderation case ${caseId} for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Remove moderation case
   * @param {string} guildId - Guild ID
   * @param {number} caseId - Case ID
   * @returns {Promise<boolean>} Success status
   */
  async removeModerationCase(guildId, caseId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof caseId !== 'number' || caseId < 1) {
      throw new ValidationError('Valid case ID is required', 'caseId', caseId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const moderation = guildData.Moderation || [];
      const initialLength = moderation.length;
      
      guildData.Moderation = moderation.filter(mod => mod.caseId !== caseId);
      
      if (guildData.Moderation.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }
      
      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove moderation case ${caseId} for guild ${guildId}`, error);
    }
  }

  // ===== LEVEL SYSTEM =====

  /**
   * Check if level system is enabled
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} True if enabled
   */
  async isLevelSystemEnabled(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const levelSystem = guildData.LevelSystem || {};
      return levelSystem.enabled || false;
    } catch (error) {
      console.error(`Error checking level system status for guild ${guildId}:`, error.message);
      return false;
    }
  }

  /**
   * Enable/disable level system
   * @param {string} guildId - Guild ID
   * @param {boolean} enabled - Enable or disable
   * @returns {Promise<boolean>} Success status
   */
  async setLevelSystemEnabled(guildId, enabled) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof enabled !== 'boolean') {
      throw new ValidationError('Enabled must be a boolean', 'enabled', enabled);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      if (!guildData.LevelSystem) {
        guildData.LevelSystem = {};
      }
      
      guildData.LevelSystem.enabled = enabled;
      
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set level system status for guild ${guildId}`, error);
    }
  }

  /**
   * Get user level data
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User level data
   */
  async getUserLevel(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const userLevels = guildData.UserLevels || [];
      
      return userLevels.find(ul => ul.userId === userId) || {
        userId,
        level: 1,
        experience: 0,
        totalExperience: 0,
        lastMessageTime: null
      };
    } catch (error) {
      console.error(`Error getting user level for ${userId} in guild ${guildId}:`, error.message);
      return {
        userId,
        level: 1,
        experience: 0,
        totalExperience: 0,
        lastMessageTime: null
      };
    }
  }

  /**
   * Add experience to user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {number} expGain - Experience to add
   * @returns {Promise<Object>} Level up result
   */
  async addExperience(guildId, userId, expGain) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof expGain !== 'number' || expGain < 0) {
      throw new ValidationError('Experience gain must be a positive number', 'expGain', expGain);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      let userLevels = guildData.UserLevels || [];
      
      let userIndex = userLevels.findIndex(ul => ul.userId === userId);
      let userData;
      
      if (userIndex !== -1) {
        userData = userLevels[userIndex];
      } else {
        userData = {
          userId,
          level: 1,
          experience: 0,
          totalExperience: 0,
          lastMessageTime: null
        };
        userLevels.push(userData);
        userIndex = userLevels.length - 1;
      }

      userData.experience += expGain;
      userData.totalExperience += expGain;
      userData.lastMessageTime = new Date();

      // Check for level up
      let leveledUp = false;
      let newLevel = userData.level;

      while (userData.experience >= this.getRequiredExperience(userData.level)) {
        userData.experience -= this.getRequiredExperience(userData.level);
        userData.level++;
        newLevel = userData.level;
        leveledUp = true;
      }

      guildData.UserLevels = userLevels;
      await this.set(guildId, guildData);

      return {
        leveledUp,
        newLevel,
        userData: { ...userData }
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add experience for user ${userId} in guild ${guildId}`, error);
    }
  }

  /**
   * Get user leaderboard
   * @param {string} guildId - Guild ID
   * @param {number} limit - Number of users to return
   * @returns {Promise<Object[]>} Leaderboard data
   */
  async getUserLeaderboard(guildId, limit = 10) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100', 'limit', limit);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const userLevels = guildData.UserLevels || [];
      
      return userLevels
        .sort((a, b) => {
          if (a.level !== b.level) return b.level - a.level;
          return b.experience - a.experience;
        })
        .slice(0, limit);
    } catch (error) {
      console.error(`Error getting leaderboard for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Get user rank
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<number|null>} User rank or null
   */
  async getUserRank(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const userLevels = guildData.UserLevels || [];
      
      const sorted = userLevels.sort((a, b) => {
        if (a.level !== b.level) return b.level - a.level;
        return b.experience - a.experience;
      });

      const rank = sorted.findIndex(ul => ul.userId === userId) + 1;
      return rank > 0 ? rank : null;
    } catch (error) {
      console.error(`Error getting user rank for ${userId} in guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Set user level
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {number} level - New level
   * @param {number} experience - New experience
   * @returns {Promise<boolean>} Success status
   */
  async setUserLevel(guildId, userId, level, experience = 0) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof level !== 'number' || level < 1) {
      throw new ValidationError('Level must be a positive number', 'level', level);
    }

    if (typeof experience !== 'number' || experience < 0) {
      throw new ValidationError('Experience must be a non-negative number', 'experience', experience);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      let userLevels = guildData.UserLevels || [];
      
      const userIndex = userLevels.findIndex(ul => ul.userId === userId);
      
      if (userIndex !== -1) {
        userLevels[userIndex].level = level;
        userLevels[userIndex].experience = experience;
        userLevels[userIndex].totalExperience = this.calculateTotalExperience(level, experience);
      } else {
        userLevels.push({
          userId,
          level,
          experience,
          totalExperience: this.calculateTotalExperience(level, experience),
          lastMessageTime: null
        });
      }

      guildData.UserLevels = userLevels;
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set user level for ${userId} in guild ${guildId}`, error);
    }
  }

  /**
   * Reset all user levels
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async resetAllUserLevels(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.UserLevels = [];
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to reset user levels for guild ${guildId}`, error);
    }
  }

  // ===== LEVEL SYSTEM HELPER METHODS =====

  /**
   * Calculate required experience for a level
   * @param {number} level - Level number
   * @returns {number} Required experience
   */
  getRequiredExperience(level) {
    return Math.floor(100 * Math.pow(1.2, level - 1));
  }

  /**
   * Calculate total experience for level and current exp
   * @param {number} level - Current level
   * @param {number} currentExp - Current experience in level
   * @returns {number} Total experience
   */
  calculateTotalExperience(level, currentExp) {
    let total = currentExp;
    for (let i = 1; i < level; i++) {
      total += this.getRequiredExperience(i);
    }
    return total;
  }

  // ===== UTILITY METHODS =====

  /**
   * Check if guild exists in database
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} True if guild exists
   */
  async guildExists(guildId) {
    if (!guildId) {
      return false;
    }

    try {
      const guildData = await this.get(guildId);
      return guildData !== null;
    } catch (error) {
      console.error(`Error checking if guild ${guildId} exists:`, error.message);
      return false;
    }
  }

  /**
   * Get guild statistics
   * @returns {Object} Guild service statistics
   */
  getGuildStats() {
    return {
      ...this.getCacheStats(),
      serviceName: 'GuildService',
      modelName: this.modelName,
      database: this.database
    };
  }

  // ===== BATCH OPERATIONS =====

  /**
   * Get prefixes for multiple guilds (batch operation with cache-first strategy)
   * @param {string[]} guildIds - Array of guild IDs
   * @returns {Promise<Map<string, string>>} Map of guildId -> prefix
   */
  async batchGetPrefixes(guildIds) {
    if (!Array.isArray(guildIds) || guildIds.length === 0) {
      throw new ValidationError('Guild IDs array is required', 'guildIds', guildIds);
    }

    const results = new Map();
    const missingIds = [];

    // Step 1: Check cache for all guilds
    for (const guildId of guildIds) {
      const cached = this.cache.get(guildId);
      if (cached) {
        results.set(guildId, cached.Prefix || ',');
      } else {
        missingIds.push(guildId);
      }
    }

    // Step 2: If all found in cache, return immediately
    if (missingIds.length === 0) {
      return results;
    }

    // Step 3: Batch fetch missing guilds from database
    try {
      const Model = this.getModel();
      const guilds = await Model.find({
        [this.keyField]: { $in: missingIds }
      }).lean();

      // Cache and add to results
      for (const guild of guilds) {
        const guildId = guild[this.keyField];
        this.cache.set(guildId, guild);
        results.set(guildId, guild.Prefix || ',');
      }

      // Add default prefix for guilds not found in database
      for (const guildId of missingIds) {
        if (!results.has(guildId)) {
          results.set(guildId, ',');
        }
      }

      return results;
    } catch (error) {
      console.error('Error in batch get prefixes:', error.message);
      // Return what we have from cache
      return results;
    }
  }

  /**
   * Get guild data for multiple guilds (batch operation)
   * @param {string[]} guildIds - Array of guild IDs
   * @returns {Promise<Map<string, Object>>} Map of guildId -> guild data
   */
  async batchGetGuilds(guildIds) {
    if (!Array.isArray(guildIds) || guildIds.length === 0) {
      throw new ValidationError('Guild IDs array is required', 'guildIds', guildIds);
    }

    const results = new Map();
    const missingIds = [];

    // Check cache first
    for (const guildId of guildIds) {
      const cached = this.cache.get(guildId);
      if (cached) {
        results.set(guildId, cached);
      } else {
        missingIds.push(guildId);
      }
    }

    // If all found in cache, return
    if (missingIds.length === 0) {
      return results;
    }

    // Batch fetch from database
    try {
      const Model = this.getModel();
      const guilds = await Model.find({
        [this.keyField]: { $in: missingIds }
      }).lean();

      // Cache and add to results
      for (const guild of guilds) {
        const guildId = guild[this.keyField];
        this.cache.set(guildId, guild);
        results.set(guildId, guild);
      }

      return results;
    } catch (error) {
      console.error('Error in batch get guilds:', error.message);
      return results;
    }
  }

  /**
   * Get specific field for multiple guilds (batch operation)
   * @param {string[]} guildIds - Array of guild IDs
   * @param {string} field - Field name to retrieve
   * @returns {Promise<Map<string, any>>} Map of guildId -> field value
   */
  async batchGetField(guildIds, field) {
    if (!Array.isArray(guildIds) || guildIds.length === 0) {
      throw new ValidationError('Guild IDs array is required', 'guildIds', guildIds);
    }

    if (!field) {
      throw new ValidationError('Field name is required', 'field', field);
    }

    const guilds = await this.batchGetGuilds(guildIds);
    const results = new Map();

    for (const [guildId, guildData] of guilds) {
      results.set(guildId, guildData?.[field]);
    }

    return results;
  }

  // ===== COUNTING OPERATIONS =====

  /**
   * Get counting configuration for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Counting configuration
   */
  async getCounting(guildId) {
    const guild = await this.ensureGuildData(guildId);
    return guild?.Counting || {
      channelId: null,
      currentCount: 0,
      lastCounterId: null
    };
  }

  /**
   * Set counting configuration for a guild
   * @param {string} guildId - Guild ID
   * @param {Object} countingData - Counting configuration
   * @returns {Promise<void>}
   */
  async setCounting(guildId, countingData) {
    await this.updateGuildData(guildId, {
      Counting: countingData
    });
  }

  // ===== AUTO REACT OPERATIONS =====

  /**
   * Get all autoreacts for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Array of autoreact objects
   */
  async getAutoReacts(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.AutoReact || [];
    } catch (error) {
      console.error(`Error getting autoreacts for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Add an autoreact
   * @param {string} guildId - Guild ID
   * @param {string} word - Trigger word
   * @param {string} emojiId - Emoji ID (null for unicode)
   * @param {string} emojiName - Emoji name
   * @param {boolean} isCustom - Whether it's a custom emoji
   * @returns {Promise<boolean>} Success status
   */
  async addAutoReact(guildId, word, emojiId, emojiName, isCustom) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!word) {
      throw new ValidationError('Word is required', 'word', word);
    }

    if (!emojiName) {
      throw new ValidationError('Emoji name is required', 'emojiName', emojiName);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const autoReacts = guildData.AutoReact || [];

      const newAutoReact = {
        word: word.toLowerCase(),
        emojiId,
        emojiName,
        isCustom: isCustom || false
      };

      autoReacts.push(newAutoReact);
      guildData.AutoReact = autoReacts;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add autoreact for guild ${guildId}`, error);
    }
  }

  /**
   * Remove an autoreact
   * @param {string} guildId - Guild ID
   * @param {string} word - Trigger word
   * @returns {Promise<boolean>} Success status
   */
  async removeAutoReact(guildId, word) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!word) {
      throw new ValidationError('Word is required', 'word', word);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const autoReacts = guildData.AutoReact || [];

      guildData.AutoReact = autoReacts.filter(ar => ar.word !== word.toLowerCase());

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove autoreact for guild ${guildId}`, error);
    }
  }

  /**
   * Clear all autoreacts
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async clearAllAutoReacts(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.AutoReact = [];

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to clear autoreacts for guild ${guildId}`, error);
    }
  }

  // ===== AUTO RESPONDER OPERATIONS =====

  /**
   * Get all autoresponders for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Array of autoresponder objects
   */
  async getAutoResponders(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.AutoResponder || [];
    } catch (error) {
      console.error(`Error getting autoresponders for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Add an autoresponder
   * @param {string} guildId - Guild ID
   * @param {Object} autoresponderData - Autoresponder data
   * @returns {Promise<boolean>} Success status
   */
  async addAutoResponder(guildId, autoresponderData) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!autoresponderData || typeof autoresponderData !== 'object') {
      throw new ValidationError('Autoresponder data is required', 'autoresponderData', autoresponderData);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const autoResponders = guildData.AutoResponder || [];

      autoResponders.push(autoresponderData);
      guildData.AutoResponder = autoResponders;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add autoresponder for guild ${guildId}`, error);
    }
  }

  /**
   * Remove an autoresponder
   * @param {string} guildId - Guild ID
   * @param {string} trigger - Trigger text
   * @returns {Promise<boolean>} Success status
   */
  async removeAutoResponder(guildId, trigger) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!trigger) {
      throw new ValidationError('Trigger is required', 'trigger', trigger);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const autoResponders = guildData.AutoResponder || [];

      guildData.AutoResponder = autoResponders.filter(ar => ar.trigger !== trigger);

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove autoresponder for guild ${guildId}`, error);
    }
  }

  /**
   * Clear all autoresponders
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async clearAllAutoResponders(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.AutoResponder = [];

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to clear autoresponders for guild ${guildId}`, error);
    }
  }

  // ===== SWEAR TRACKING OPERATIONS =====

  /**
   * Get swear tracking data for a user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of swear tracking objects
   */
  async getSwears(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const swearTracker = guildData.SwearTracker || [];
      return swearTracker.filter(st => st.userId === userId);
    } catch (error) {
      console.error(`Error getting swears for user ${userId} in guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Add a swear to tracking
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {string} swear - Swear word
   * @returns {Promise<boolean>} Success status
   */
  async addSwear(guildId, userId, swear) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!swear) {
      throw new ValidationError('Swear is required', 'swear', swear);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const swearTracker = guildData.SwearTracker || [];

      swearTracker.push({
        userId,
        swear: swear.toLowerCase(),
        timestamp: new Date()
      });

      guildData.SwearTracker = swearTracker;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add swear for guild ${guildId}`, error);
    }
  }

  /**
   * Get all swears for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Array of all swear tracking objects
   */
  async getAllSwears(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.SwearTracker || [];
    } catch (error) {
      console.error(`Error getting all swears for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Clear swear tracking for a user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async clearUserSwears(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const swearTracker = guildData.SwearTracker || [];

      guildData.SwearTracker = swearTracker.filter(st => st.userId !== userId);

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to clear swears for user ${userId} in guild ${guildId}`, error);
    }
  }

  // ===== MESSAGE TRACKING OPERATIONS =====

  /**
   * Track a message for a user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async trackMessage(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const messageStats = guildData.MessageStats || [];

      const userIndex = messageStats.findIndex(ms => ms.userId === userId);

      if (userIndex !== -1) {
        messageStats[userIndex].count = (messageStats[userIndex].count || 0) + 1;
        messageStats[userIndex].lastMessage = new Date();
      } else {
        messageStats.push({
          userId,
          count: 1,
          lastMessage: new Date()
        });
      }

      guildData.MessageStats = messageStats;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to track message for guild ${guildId}`, error);
    }
  }

  /**
   * Get message stats for a user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Message stats or null
   */
  async getMessageStats(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const messageStats = guildData.MessageStats || [];

      return messageStats.find(ms => ms.userId === userId) || null;
    } catch (error) {
      console.error(`Error getting message stats for user ${userId} in guild ${guildId}:`, error.message);
      return null;
    }
  }

  // ===== STICKY MESSAGE OPERATIONS =====

  /**
   * Update sticky message activity
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<boolean>} Success status
   */
  async updateStickyMessageActivity(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const stickyMessages = guildData.StickyMessages || [];

      const stickyIndex = stickyMessages.findIndex(sm => sm.channelId === channelId);

      if (stickyIndex !== -1) {
        stickyMessages[stickyIndex].lastActivity = new Date();
        guildData.StickyMessages = stickyMessages;
        await this.set(guildId, guildData);
      }

      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update sticky message activity for guild ${guildId}`, error);
    }
  }

  // ===== LEVEL SYSTEM ADDITIONAL OPERATIONS =====

  /**
   * Get level message mode
   * @param {string} guildId - Guild ID
   * @returns {Promise<string>} Message mode ('context', 'channel', or 'none')
   */
  async getLevelMessageMode(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const levelSystem = guildData.LevelSystem || {};
      return levelSystem.messageMode || 'context';
    } catch (error) {
      console.error(`Error getting level message mode for guild ${guildId}:`, error.message);
      return 'context';
    }
  }

  /**
   * Get level up channel
   * @param {string} guildId - Guild ID
   * @returns {Promise<string|null>} Channel ID or null
   */
  async getLevelUpChannel(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const levelSystem = guildData.LevelSystem || {};
      return levelSystem.levelUpChannel || null;
    } catch (error) {
      console.error(`Error getting level up channel for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Get level roles
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Array of level role objects
   */
  async getLevelRoles(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const levelSystem = guildData.LevelSystem || {};
      return levelSystem.levelRoles || [];
    } catch (error) {
      console.error(`Error getting level roles for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Add user experience (alias for addExperience)
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {number} expGain - Experience to add
   * @returns {Promise<Object>} Level up result
   */
  async addUserExperience(guildId, userId, expGain) {
    return await this.addExperience(guildId, userId, expGain);
  }

  // ===== STARBOARD OPERATIONS =====

  /**
   * Get starboard channel
   * @param {string} guildId - Guild ID
   * @returns {Promise<string|null>} Starboard channel ID or null
   */
  async getStarboardChannel(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.StarboardChannel || null;
    } catch (error) {
      console.error(`Error getting starboard channel for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Get starboard threshold
   * @param {string} guildId - Guild ID
   * @returns {Promise<number>} Starboard threshold (default: 3)
   */
  async getStarboardThreshold(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.StarboardThreshold || 3;
    } catch (error) {
      console.error(`Error getting starboard threshold for guild ${guildId}:`, error.message);
      return 3;
    }
  }

  /**
   * Get starboard emoji
   * @param {string} guildId - Guild ID
   * @returns {Promise<string>} Starboard emoji (default: ⭐)
   */
  async getStarboardEmoji(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.StarboardEmoji || '⭐';
    } catch (error) {
      console.error(`Error getting starboard emoji for guild ${guildId}:`, error.message);
      return '⭐';
    }
  }

  /**
   * Set starboard settings
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Starboard channel ID
   * @param {number} threshold - Starboard threshold
   * @param {string} emoji - Starboard emoji
   * @returns {Promise<boolean>} Success status
   */
  async setStarboardSettings(guildId, channelId, threshold = 3, emoji = '⭐') {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.StarboardChannel = channelId;
      guildData.StarboardThreshold = threshold;
      guildData.StarboardEmoji = emoji;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set starboard settings for guild ${guildId}`, error);
    }
  }

  /**
   * Find starboard message
   * @param {string} guildId - Guild ID
   * @param {string} messageId - Original message ID
   * @returns {Promise<Object|null>} Starboard message data or null
   */
  async findStarboardMessage(guildId, messageId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!messageId) {
      throw new ValidationError('Message ID is required', 'messageId', messageId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const starboardMessages = guildData.StarboardMessages || [];

      return starboardMessages.find(sm => sm.messageId === messageId) || null;
    } catch (error) {
      console.error(`Error finding starboard message for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Add starboard message
   * @param {string} guildId - Guild ID
   * @param {string} messageId - Original message ID
   * @param {string} starboardMessageId - Starboard message ID
   * @param {string} channelId - Original channel ID
   * @param {string} authorId - Original author ID
   * @param {number} count - Reaction count
   * @returns {Promise<boolean>} Success status
   */
  async addStarboardMessage(guildId, messageId, starboardMessageId, channelId, authorId, count) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!messageId) {
      throw new ValidationError('Message ID is required', 'messageId', messageId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const starboardMessages = guildData.StarboardMessages || [];

      starboardMessages.push({
        messageId,
        starboardMessageId,
        channelId,
        authorId,
        count,
        createdAt: new Date()
      });

      guildData.StarboardMessages = starboardMessages;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add starboard message for guild ${guildId}`, error);
    }
  }

  /**
   * Update starboard message count
   * @param {string} guildId - Guild ID
   * @param {string} messageId - Original message ID
   * @param {number} count - New reaction count
   * @returns {Promise<boolean>} Success status
   */
  async updateStarboardMessageCount(guildId, messageId, count) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!messageId) {
      throw new ValidationError('Message ID is required', 'messageId', messageId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const starboardMessages = guildData.StarboardMessages || [];

      const message = starboardMessages.find(sm => sm.messageId === messageId);
      if (message) {
        message.count = count;
        guildData.StarboardMessages = starboardMessages;
        await this.set(guildId, guildData);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update starboard message count for guild ${guildId}`, error);
    }
  }

  /**
   * Remove starboard message
   * @param {string} guildId - Guild ID
   * @param {string} messageId - Original message ID
   * @returns {Promise<boolean>} Success status
   */
  async removeStarboardMessage(guildId, messageId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!messageId) {
      throw new ValidationError('Message ID is required', 'messageId', messageId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const starboardMessages = guildData.StarboardMessages || [];

      guildData.StarboardMessages = starboardMessages.filter(sm => sm.messageId !== messageId);

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove starboard message for guild ${guildId}`, error);
    }
  }

  // ===== GIVEAWAY OPERATIONS =====

  /**
   * Get giveaway by message ID
   * @param {string} guildId - Guild ID
   * @param {string} messageId - Giveaway message ID
   * @returns {Promise<Object|null>} Giveaway data or null
   */
  async getGiveawayByMessageId(guildId, messageId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!messageId) {
      throw new ValidationError('Message ID is required', 'messageId', messageId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const giveaways = guildData.Giveaways || [];

      return giveaways.find(g => g.messageId === messageId) || null;
    } catch (error) {
      console.error(`Error getting giveaway by message ID for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Get giveaway by ID
   * @param {string} guildId - Guild ID
   * @param {number} giveawayId - Giveaway ID
   * @returns {Promise<Object|null>} Giveaway data or null
   */
  async getGiveaway(guildId, giveawayId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof giveawayId !== 'number') {
      throw new ValidationError('Giveaway ID must be a number', 'giveawayId', giveawayId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const giveaways = guildData.Giveaways || [];

      return giveaways.find(g => g.id === giveawayId) || null;
    } catch (error) {
      console.error(`Error getting giveaway for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Add giveaway participant
   * @param {string} guildId - Guild ID
   * @param {number} giveawayId - Giveaway ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async addGiveawayParticipant(guildId, giveawayId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof giveawayId !== 'number') {
      throw new ValidationError('Giveaway ID must be a number', 'giveawayId', giveawayId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const giveaways = guildData.Giveaways || [];

      const giveaway = giveaways.find(g => g.id === giveawayId);
      if (giveaway) {
        if (!giveaway.participants) {
          giveaway.participants = [];
        }

        if (!giveaway.participants.includes(userId)) {
          giveaway.participants.push(userId);
          guildData.Giveaways = giveaways;
          await this.set(guildId, guildData);
        }

        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add giveaway participant for guild ${guildId}`, error);
    }
  }

  /**
   * Get all active giveaways
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Array of active giveaways
   */
  async getActiveGiveaways(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const giveaways = guildData.Giveaways || [];

      return giveaways.filter(g => g.isActive);
    } catch (error) {
      console.error(`Error getting active giveaways for guild ${guildId}:`, error.message);
      return [];
    }
  }
}

module.exports = GuildService;
