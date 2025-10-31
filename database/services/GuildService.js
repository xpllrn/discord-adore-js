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

  /**
   * Get welcome channel (legacy method for backward compatibility)
   * @param {string} guildId - Guild ID
   * @returns {Promise<string|null>} Welcome channel ID or null
   */
  async getWelcomeChannel(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.WelcomeChannel || null;
    } catch (error) {
      console.error(`Error getting welcome channel for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Get welcome message (legacy method for backward compatibility)
   * @param {string} guildId - Guild ID
   * @returns {Promise<string|null>} Welcome message or null
   */
  async getWelcomeMessage(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.WelcomeMessage || null;
    } catch (error) {
      console.error(`Error getting welcome message for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Remove welcome (legacy method for backward compatibility)
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async removeWelcome(guildId) {
    return this.removeWelcomeSettings(guildId);
  }

  /**
   * Get welcome messages (multi-message system)
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object[]>} Array of welcome messages
   */
  async getWelcomeMessages(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.WelcomeMessages || [];
    } catch (error) {
      console.error(`Error getting welcome messages for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Get welcome message for specific channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Welcome message or null
   */
  async getWelcomeMessageForChannel(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const welcomeMessages = guildData.WelcomeMessages || [];
      return welcomeMessages.find(wm => wm.channelId === channelId) || null;
    } catch (error) {
      console.error(`Error getting welcome message for channel in guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Add welcome message (multi-message system)
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @param {string} message - Welcome message
   * @returns {Promise<boolean>} Success status
   */
  async addWelcomeMessage(guildId, channelId, message) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!message || message.trim().length === 0) {
      throw new ValidationError('Welcome message is required', 'message', message);
    }

    if (message.length > 2000) {
      throw new ValidationError('Welcome message cannot exceed 2000 characters', 'message', message);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const welcomeMessages = guildData.WelcomeMessages || [];

      // Check if message for this channel already exists
      const existingIndex = welcomeMessages.findIndex(wm => wm.channelId === channelId);

      if (existingIndex !== -1) {
        // Update existing message
        welcomeMessages[existingIndex].message = message.trim();
        welcomeMessages[existingIndex].createdAt = new Date();
      } else {
        // Add new message
        welcomeMessages.push({
          channelId,
          message: message.trim(),
          createdAt: new Date()
        });
      }

      guildData.WelcomeMessages = welcomeMessages;
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add welcome message for guild ${guildId}`, error);
    }
  }

  /**
   * Remove welcome message (multi-message system)
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<boolean>} Success status
   */
  async removeWelcomeMessage(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const welcomeMessages = guildData.WelcomeMessages || [];
      const initialLength = welcomeMessages.length;

      guildData.WelcomeMessages = welcomeMessages.filter(wm => wm.channelId !== channelId);

      if (guildData.WelcomeMessages.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove welcome message for guild ${guildId}`, error);
    }
  }

  // ===== LEVEL MESSAGE SYSTEM =====

  /**
   * Set custom level message
   * @param {string} guildId - Guild ID
   * @param {string} message - Custom level message
   * @returns {Promise<boolean>} Success status
   */
  async setLevelCustomMessage(guildId, message) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!message || message.trim().length === 0) {
      throw new ValidationError('Custom message is required', 'message', message);
    }

    if (message.trim().length > 2000) {
      throw new ValidationError('Custom message cannot exceed 2000 characters', 'message', message);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.LevelSystem) {
        guildData.LevelSystem = {
          enabled: false,
          messageMode: 'context',
          levelUpChannel: null,
          customMessage: null,
          levelRoles: [],
          lastSyncTime: null
        };
      }

      guildData.LevelSystem.customMessage = message.trim();

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set custom level message for guild ${guildId}`, error);
    }
  }

  /**
   * Get custom level message
   * @param {string} guildId - Guild ID
   * @returns {Promise<string|null>} Custom message or null
   */
  async getLevelCustomMessage(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.LevelSystem?.customMessage || null;
    } catch (error) {
      console.error(`Error getting custom level message for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Remove custom level message
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async removeLevelCustomMessage(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.LevelSystem) {
        return false; // No level system exists
      }

      guildData.LevelSystem.customMessage = null;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove custom level message for guild ${guildId}`, error);
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

  /**
   * Get leave channel (legacy method for backward compatibility)
   * @param {string} guildId - Guild ID
   * @returns {Promise<string|null>} Leave channel ID or null
   */
  async getLeaveChannel(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.LeaveChannel || null;
    } catch (error) {
      console.error(`Error getting leave channel for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Get leave message (legacy method for backward compatibility - returns string not object)
   * @param {string} guildId - Guild ID
   * @returns {Promise<string|null>} Leave message or null
   */
  async getLeaveMessage(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.LeaveMessage || null;
    } catch (error) {
      console.error(`Error getting leave message for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Remove leave (legacy method for backward compatibility)
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async removeLeave(guildId) {
    return this.removeLeaveSettings(guildId);
  }

  /**
   * Get leave messages (multi-message system)
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object[]>} Array of leave messages
   */
  async getLeaveMessages(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.LeaveMessages || [];
    } catch (error) {
      console.error(`Error getting leave messages for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Get leave message for specific channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Leave message or null
   */
  async getLeaveMessageForChannel(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const leaveMessages = guildData.LeaveMessages || [];
      return leaveMessages.find(lm => lm.channelId === channelId) || null;
    } catch (error) {
      console.error(`Error getting leave message for channel in guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Add leave message (multi-message system)
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @param {string} message - Leave message
   * @returns {Promise<boolean>} Success status
   */
  async addLeaveMessage(guildId, channelId, message) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!message || message.trim().length === 0) {
      throw new ValidationError('Leave message is required', 'message', message);
    }

    if (message.length > 2000) {
      throw new ValidationError('Leave message cannot exceed 2000 characters', 'message', message);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const leaveMessages = guildData.LeaveMessages || [];

      // Check if message for this channel already exists
      const existingIndex = leaveMessages.findIndex(lm => lm.channelId === channelId);

      if (existingIndex !== -1) {
        // Update existing message
        leaveMessages[existingIndex].message = message.trim();
        leaveMessages[existingIndex].createdAt = new Date();
      } else {
        // Add new message
        leaveMessages.push({
          channelId,
          message: message.trim(),
          createdAt: new Date()
        });
      }

      guildData.LeaveMessages = leaveMessages;
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add leave message for guild ${guildId}`, error);
    }
  }

  /**
   * Remove leave message (multi-message system)
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<boolean>} Success status
   */
  async removeLeaveMessage(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const leaveMessages = guildData.LeaveMessages || [];
      const initialLength = leaveMessages.length;

      guildData.LeaveMessages = leaveMessages.filter(lm => lm.channelId !== channelId);

      if (guildData.LeaveMessages.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove leave message for guild ${guildId}`, error);
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

  /**
   * Get boost messages (multi-message system)
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object[]>} Array of boost messages
   */
  async getBoostMessages(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.BoostMessages || [];
    } catch (error) {
      console.error(`Error getting boost messages for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Get boost message for specific channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Boost message or null
   */
  async getBoostMessage(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boostMessages = guildData.BoostMessages || [];
      return boostMessages.find(bm => bm.channelId === channelId) || null;
    } catch (error) {
      console.error(`Error getting boost message for channel in guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Add boost message (multi-message system)
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @param {string} message - Boost message
   * @returns {Promise<boolean>} Success status
   */
  async addBoostMessage(guildId, channelId, message) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!message || message.trim().length === 0) {
      throw new ValidationError('Boost message is required', 'message', message);
    }

    if (message.length > 2000) {
      throw new ValidationError('Boost message cannot exceed 2000 characters', 'message', message);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boostMessages = guildData.BoostMessages || [];

      // Check if message for this channel already exists
      const existingIndex = boostMessages.findIndex(bm => bm.channelId === channelId);

      if (existingIndex !== -1) {
        // Update existing message
        boostMessages[existingIndex].message = message.trim();
        boostMessages[existingIndex].createdAt = new Date();
      } else {
        // Add new message
        boostMessages.push({
          channelId,
          message: message.trim(),
          createdAt: new Date()
        });
      }

      guildData.BoostMessages = boostMessages;
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add boost message for guild ${guildId}`, error);
    }
  }

  /**
   * Remove boost message (multi-message system)
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<boolean>} Success status
   */
  async removeBoostMessage(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boostMessages = guildData.BoostMessages || [];
      const initialLength = boostMessages.length;

      guildData.BoostMessages = boostMessages.filter(bm => bm.channelId !== channelId);

      if (guildData.BoostMessages.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove boost message for guild ${guildId}`, error);
    }
  }

  /**
   * Get recent boost removals
   * @param {string} guildId - Guild ID
   * @param {number} limit - Number of recent removals to return
   * @returns {Promise<Object[]>} Array of boost removal events
   */
  async getRecentBoostRemoves(guildId, limit = 20) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boostHistory = guildData.BoostHistory || [];

      return boostHistory
        .filter(bh => bh.action === 'remove')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } catch (error) {
      console.error(`Error getting recent boost removes for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Get recent boost additions
   * @param {string} guildId - Guild ID
   * @param {number} limit - Number of recent additions to return
   * @returns {Promise<Object[]>} Array of boost addition events
   */
  async getRecentBoostAdds(guildId, limit = 20) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boostHistory = guildData.BoostHistory || [];

      return boostHistory
        .filter(bh => bh.action === 'add')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } catch (error) {
      console.error(`Error getting recent boost adds for guild ${guildId}:`, error.message);
      return [];
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

  /**
   * Set jail (alias for setJailSettings)
   * @param {string} guildId - Guild ID
   * @param {string} roleId - Jail role ID
   * @param {string} channelId - Jail channel ID
   * @returns {Promise<boolean>} Success status
   */
  async setJail(guildId, roleId, channelId) {
    return await this.setJailSettings(guildId, roleId, channelId);
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
   * Enable level system
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async enableLevelSystem(guildId) {
    return await this.setLevelSystemEnabled(guildId, true);
  }

  /**
   * Disable level system
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async disableLevelSystem(guildId) {
    return await this.setLevelSystemEnabled(guildId, false);
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
        lastMessageTime: null
      };
    } catch (error) {
      console.error(`Error getting user level for ${userId} in guild ${guildId}:`, error.message);
      return {
        userId,
        level: 1,
        experience: 0,
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
          lastMessageTime: null
        };
        userLevels.push(userData);
        userIndex = userLevels.length - 1;
      }

      userData.experience += expGain;
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

    if (typeof limit !== 'number' || limit < 1 || limit > 10000) {
      throw new ValidationError('Limit must be between 1 and 10000', 'limit', limit);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const userLevels = guildData.UserLevels || [];

      return userLevels
        .sort((a, b) => {
          // Sort by level first (descending), then by experience (descending)
          if (a.level !== b.level) {
            return b.level - a.level;
          }
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

      // If no users have levels yet, user is rank 1
      if (userLevels.length === 0) {
        return 1;
      }

      const sorted = userLevels.sort((a, b) => {
        if (a.level !== b.level) return b.level - a.level;
        return b.experience - a.experience;
      });

      const rank = sorted.findIndex(ul => ul.userId === userId) + 1;

      // If user not found in levels, they're last place (after all ranked users)
      return rank > 0 ? rank : sorted.length + 1;
    } catch (error) {
      console.error(`Error getting user rank for ${userId} in guild ${guildId}:`, error.message);
      return 1; // Default to rank 1 on error
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
      } else {
        userLevels.push({
          userId,
          level,
          experience,
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
      lastCounterId: null,
      strict: true
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
   * @returns {Promise<Object|null>} User swear tracking object or null
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
      return swearTracker.find(st => st.userId === userId) || null;
    } catch (error) {
      console.error(`Error getting swears for user ${userId} in guild ${guildId}:`, error.message);
      return null;
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
      const word = swear.toLowerCase();
      const now = new Date();

      // Find existing user entry
      let userEntry = swearTracker.find(st => st.userId === userId);

      if (!userEntry) {
        // Create new user entry with proper schema structure
        userEntry = {
          userId,
          swears: [],
          totalSwears: 0,
          todaySwears: 0,
          lastSwearDate: now
        };
        swearTracker.push(userEntry);
      }

      // Find existing swear word in user's swears array
      let swearEntry = userEntry.swears.find(s => s.word === word);

      if (swearEntry) {
        // Increment existing swear count
        swearEntry.count++;
        swearEntry.lastUsed = now;
      } else {
        // Add new swear word
        userEntry.swears.push({
          word,
          count: 1,
          lastUsed: now
        });
      }

      // Update totals
      userEntry.totalSwears++;

      // Check if it's today and update todaySwears
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastSwearDate = new Date(userEntry.lastSwearDate);
      lastSwearDate.setHours(0, 0, 0, 0);

      if (lastSwearDate.getTime() === today.getTime()) {
        // Same day, increment today's count
        userEntry.todaySwears++;
      } else {
        // New day, reset today's count
        userEntry.todaySwears = 1;
      }

      userEntry.lastSwearDate = now;

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

      // Find and remove the user's entry
      const initialLength = swearTracker.length;
      guildData.SwearTracker = swearTracker.filter(st => st.userId !== userId);

      if (guildData.SwearTracker.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false; // User had no swear data
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to clear swears for user ${userId} in guild ${guildId}`, error);
    }
  }

  /**
   * Get user swear data with aggregated counts
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User swear data with aggregated counts
   */
  async getUserSwearData(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const swearTracker = guildData.SwearTracker || [];

      // Find user entry in the tracker
      const userEntry = swearTracker.find(st => st.userId === userId);

      if (!userEntry || !userEntry.swears || userEntry.swears.length === 0) {
        return {
          userId,
          swears: [],
          todaySwears: 0,
          totalSwears: 0
        };
      }

      // Check if todaySwears needs to be reset (if lastSwearDate is not today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastSwearDate = new Date(userEntry.lastSwearDate);
      lastSwearDate.setHours(0, 0, 0, 0);

      const todaySwears = lastSwearDate.getTime() === today.getTime()
        ? (userEntry.todaySwears || 0)
        : 0;

      return {
        userId,
        swears: userEntry.swears.map(s => ({
          word: s.word,
          count: s.count
        })),
        todaySwears,
        totalSwears: userEntry.totalSwears || 0
      };
    } catch (error) {
      console.error(`Error getting user swear data for guild ${guildId}:`, error.message);
      return {
        userId,
        swears: [],
        todaySwears: 0,
        totalSwears: 0
      };
    }
  }

  /**
   * Get swear leaderboard
   * @param {string} guildId - Guild ID
   * @param {number} limit - Number of users to return (default: 100)
   * @returns {Promise<Array>} Array of user swear data sorted by total
   */
  async getSwearLeaderboard(guildId, limit = 100) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const swearTracker = guildData.SwearTracker || [];

      if (swearTracker.length === 0) {
        return [];
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Map user entries to leaderboard format
      const leaderboard = swearTracker
        .filter(userEntry => userEntry.totalSwears > 0)
        .map(userEntry => {
          // Check if todaySwears needs to be reset
          const lastSwearDate = new Date(userEntry.lastSwearDate);
          lastSwearDate.setHours(0, 0, 0, 0);
          const todaySwears = lastSwearDate.getTime() === today.getTime()
            ? (userEntry.todaySwears || 0)
            : 0;

          return {
            userId: userEntry.userId,
            calculatedTotal: userEntry.totalSwears || 0,
            todaySwears,
            swears: (userEntry.swears || []).map(s => ({
              word: s.word,
              count: s.count
            }))
          };
        });

      // Sort by total swears descending
      leaderboard.sort((a, b) => b.calculatedTotal - a.calculatedTotal);

      return leaderboard.slice(0, limit);
    } catch (error) {
      console.error(`Error getting swear leaderboard for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Get user's position in swear leaderboard
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<number|null>} User's position or null
   */
  async getUserSwearPosition(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const leaderboard = await this.getSwearLeaderboard(guildId, 1000);
      const position = leaderboard.findIndex(userData => userData.userId === userId);

      return position !== -1 ? position + 1 : null;
    } catch (error) {
      console.error(`Error getting user swear position for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Get swear tracker data
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Array of swear tracking entries
   */
  async getSwearTracker(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.SwearTracker || [];
    } catch (error) {
      console.error(`Error getting swear tracker for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Clear all swear data for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async clearAllSwearData(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.SwearTracker = [];

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to clear all swear data for guild ${guildId}`, error);
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

  /**
   * Remove user level data
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async removeUserLevel(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const userLevels = guildData.UserLevels || [];

      guildData.UserLevels = userLevels.filter(ul => ul.userId !== userId);

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove user level for guild ${guildId}`, error);
    }
  }

  /**
   * Add level role
   * @param {string} guildId - Guild ID
   * @param {number} level - Level requirement
   * @param {string} roleId - Role ID
   * @returns {Promise<boolean>} Success status
   */
  async addLevelRole(guildId, level, roleId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof level !== 'number' || level < 1) {
      throw new ValidationError('Level must be a positive number', 'level', level);
    }

    if (!roleId) {
      throw new ValidationError('Role ID is required', 'roleId', roleId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      if (!guildData.LevelSystem) {
        guildData.LevelSystem = {};
      }

      const levelRoles = guildData.LevelSystem.levelRoles || [];

      // Check if level already has a role
      const existingIndex = levelRoles.findIndex(lr => lr.level === level);
      if (existingIndex !== -1) {
        levelRoles[existingIndex].roleId = roleId;
      } else {
        levelRoles.push({ level, roleId });
      }

      guildData.LevelSystem.levelRoles = levelRoles;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add level role for guild ${guildId}`, error);
    }
  }

  /**
   * Remove level role
   * @param {string} guildId - Guild ID
   * @param {number} level - Level requirement
   * @returns {Promise<boolean>} Success status
   */
  async removeLevelRole(guildId, level) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof level !== 'number' || level < 1) {
      throw new ValidationError('Level must be a positive number', 'level', level);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      if (!guildData.LevelSystem) {
        return false;
      }

      const levelRoles = guildData.LevelSystem.levelRoles || [];
      const initialLength = levelRoles.length;

      guildData.LevelSystem.levelRoles = levelRoles.filter(lr => lr.level !== level);

      if (guildData.LevelSystem.levelRoles.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove level role for guild ${guildId}`, error);
    }
  }

  /**
   * Get last sync time for level roles
   * @param {string} guildId - Guild ID
   * @returns {Promise<Date|null>} Last sync time or null
   */
  async getLastSyncTime(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const levelSystem = guildData.LevelSystem || {};
      return levelSystem.lastSyncTime || null;
    } catch (error) {
      console.error(`Error getting last sync time for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Update last sync time for level roles
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async updateLastSyncTime(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      if (!guildData.LevelSystem) {
        guildData.LevelSystem = {};
      }

      guildData.LevelSystem.lastSyncTime = new Date();

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update last sync time for guild ${guildId}`, error);
    }
  }

  /**
   * Set level message mode
   * @param {string} guildId - Guild ID
   * @param {string} mode - Message mode ('context', 'channel', or 'none')
   * @returns {Promise<boolean>} Success status
   */
  async setLevelMessageMode(guildId, mode) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!['context', 'channel', 'none'].includes(mode)) {
      throw new ValidationError('Mode must be context, channel, or none', 'mode', mode);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      if (!guildData.LevelSystem) {
        guildData.LevelSystem = {};
      }

      guildData.LevelSystem.messageMode = mode;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set level message mode for guild ${guildId}`, error);
    }
  }

  /**
   * Set level up channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<boolean>} Success status
   */
  async setLevelUpChannel(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      if (!guildData.LevelSystem) {
        guildData.LevelSystem = {};
      }

      guildData.LevelSystem.levelUpChannel = channelId;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set level up channel for guild ${guildId}`, error);
    }
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
   * Set starboard channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Starboard channel ID (null to disable)
   * @returns {Promise<boolean>} Success status
   */
  async setStarboardChannel(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.StarboardChannel = channelId;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set starboard channel for guild ${guildId}`, error);
    }
  }

  /**
   * Set starboard threshold
   * @param {string} guildId - Guild ID
   * @param {number} threshold - Starboard threshold
   * @returns {Promise<boolean>} Success status
   */
  async setStarboardThreshold(guildId, threshold) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof threshold !== 'number' || threshold < 1) {
      throw new ValidationError('Threshold must be a positive number', 'threshold', threshold);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.StarboardThreshold = threshold;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set starboard threshold for guild ${guildId}`, error);
    }
  }

  /**
   * Set starboard emoji
   * @param {string} guildId - Guild ID
   * @param {string} emoji - Starboard emoji
   * @returns {Promise<boolean>} Success status
   */
  async setStarboardEmoji(guildId, emoji) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!emoji) {
      throw new ValidationError('Emoji is required', 'emoji', emoji);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.StarboardEmoji = emoji;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set starboard emoji for guild ${guildId}`, error);
    }
  }

  /**
   * Set starboard settings (all at once)
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

  /**
   * Add giveaway
   * @param {string} guildId - Guild ID
   * @param {Object} giveawayData - Giveaway data
   * @returns {Promise<Object>} Created giveaway
   */
  async addGiveaway(guildId, giveawayData) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!giveawayData || typeof giveawayData !== 'object') {
      throw new ValidationError('Giveaway data is required', 'giveawayData', giveawayData);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const giveaways = guildData.Giveaways || [];

      // Get next ID
      const nextId = giveaways.length > 0 ? Math.max(...giveaways.map(g => g.id)) + 1 : 1;

      const giveaway = {
        id: nextId,
        ...giveawayData,
        isActive: true,
        createdAt: new Date()
      };

      giveaways.push(giveaway);
      guildData.Giveaways = giveaways;

      await this.set(guildId, guildData);
      return giveaway;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add giveaway for guild ${guildId}`, error);
    }
  }

  /**
   * Update giveaway
   * @param {string} guildId - Guild ID
   * @param {number} giveawayId - Giveaway ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated giveaway or null
   */
  async updateGiveaway(guildId, giveawayId, updates) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof giveawayId !== 'number') {
      throw new ValidationError('Giveaway ID must be a number', 'giveawayId', giveawayId);
    }

    if (!updates || typeof updates !== 'object') {
      throw new ValidationError('Updates object is required', 'updates', updates);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const giveaways = guildData.Giveaways || [];

      const giveawayIndex = giveaways.findIndex(g => g.id === giveawayId);
      if (giveawayIndex === -1) {
        return null;
      }

      // Handle nested updates (e.g., 'requirements.level')
      for (const [key, value] of Object.entries(updates)) {
        if (key.includes('.')) {
          const parts = key.split('.');
          let current = giveaways[giveawayIndex];
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
              current[parts[i]] = {};
            }
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = value;
        } else {
          giveaways[giveawayIndex][key] = value;
        }
      }

      guildData.Giveaways = giveaways;
      await this.set(guildId, guildData);
      return giveaways[giveawayIndex];
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update giveaway for guild ${guildId}`, error);
    }
  }

  /**
   * End giveaway
   * @param {string} guildId - Guild ID
   * @param {number} giveawayId - Giveaway ID
   * @param {string[]} winners - Array of winner user IDs
   * @returns {Promise<boolean>} Success status
   */
  async endGiveaway(guildId, giveawayId, winners = []) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof giveawayId !== 'number') {
      throw new ValidationError('Giveaway ID must be a number', 'giveawayId', giveawayId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const giveaways = guildData.Giveaways || [];

      const giveaway = giveaways.find(g => g.id === giveawayId);
      if (giveaway) {
        giveaway.isActive = false;
        giveaway.winnerIds = winners;
        guildData.Giveaways = giveaways;
        await this.set(guildId, guildData);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to end giveaway for guild ${guildId}`, error);
    }
  }

  /**
   * Delete giveaway
   * @param {string} guildId - Guild ID
   * @param {number} giveawayId - Giveaway ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteGiveaway(guildId, giveawayId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof giveawayId !== 'number') {
      throw new ValidationError('Giveaway ID must be a number', 'giveawayId', giveawayId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const giveaways = guildData.Giveaways || [];
      const initialLength = giveaways.length;

      guildData.Giveaways = giveaways.filter(g => g.id !== giveawayId);

      if (guildData.Giveaways.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to delete giveaway for guild ${guildId}`, error);
    }
  }

  // ===== LAST.FM CROWN OPERATIONS =====

  /**
   * Get Last.fm crown for an artist
   * @param {string} guildId - Guild ID
   * @param {string} artistName - Artist name
   * @returns {Promise<Object|null>} Crown data or null
   */
  async getLastFMCrown(guildId, artistName) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!artistName) {
      throw new ValidationError('Artist name is required', 'artistName', artistName);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const crowns = guildData.LastFMCrowns || [];

      return crowns.find(c => 
        c && c.artistName && typeof c.artistName === 'string' && 
        c.artistName.toLowerCase() === artistName.toLowerCase()
      ) || null;
    } catch (error) {
      console.error(`Error getting Last.fm crown for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Set Last.fm crown for an artist
   * @param {string} guildId - Guild ID
   * @param {string} artistName - Artist name
   * @param {string} userId - User ID who owns the crown
   * @param {number} plays - Number of plays
   * @returns {Promise<boolean>} Success status
   */
  async setLastFMCrown(guildId, artistName, userId, plays) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!artistName) {
      throw new ValidationError('Artist name is required', 'artistName', artistName);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof plays !== 'number' || plays < 0) {
      throw new ValidationError('Plays must be a non-negative number', 'plays', plays);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const crowns = guildData.LastFMCrowns || [];

      const existingCrownIndex = crowns.findIndex(c => 
        c && c.artistName && typeof c.artistName === 'string' && 
        c.artistName.toLowerCase() === artistName.toLowerCase()
      );

      if (existingCrownIndex !== -1) {
        // Update existing crown
        crowns[existingCrownIndex] = {
          artistName,
          userId,
          plays,
          claimedAt: new Date()
        };
      } else {
        // Add new crown
        crowns.push({
          artistName,
          userId,
          plays,
          claimedAt: new Date()
        });
      }

      guildData.LastFMCrowns = crowns;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set Last.fm crown for guild ${guildId}`, error);
    }
  }

  /**
   * Get all Last.fm crowns for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Array of crown data
   */
  async getAllLastFMCrowns(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.LastFMCrowns || [];
    } catch (error) {
      console.error(`Error getting all Last.fm crowns for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Get Last.fm crowns for a specific user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of crown data for the user
   */
  async getUserLastFMCrowns(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const crowns = guildData.LastFMCrowns || [];

      return crowns.filter(c => c.userId === userId);
    } catch (error) {
      console.error(`Error getting user Last.fm crowns for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Remove Last.fm crown for an artist
   * @param {string} guildId - Guild ID
   * @param {string} artistName - Artist name
   * @returns {Promise<boolean>} Success status
   */
  async removeLastFMCrown(guildId, artistName) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!artistName) {
      throw new ValidationError('Artist name is required', 'artistName', artistName);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const crowns = guildData.LastFMCrowns || [];

      guildData.LastFMCrowns = crowns.filter(c => 
        c && c.artistName && typeof c.artistName === 'string' && 
        c.artistName.toLowerCase() !== artistName.toLowerCase()
      );

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove Last.fm crown for guild ${guildId}`, error);
    }
  }

  // ===== TICKET SYSTEM =====

  /**
   * Get ticket system configuration
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Ticket system configuration
   */
  async getTicketSystem(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.TicketSystem || {
        enabled: false,
        categoryId: null,
        supportRoleId: null,
        setupChannelId: null,
        setupMessageId: null,
        activeTickets: [],
        ticketCounter: 0
      };
    } catch (error) {
      console.error(`Error getting ticket system for guild ${guildId}:`, error.message);
      return {
        enabled: false,
        categoryId: null,
        supportRoleId: null,
        setupChannelId: null,
        setupMessageId: null,
        activeTickets: [],
        ticketCounter: 0
      };
    }
  }

  /**
   * Set ticket system configuration
   * @param {string} guildId - Guild ID
   * @param {Object} config - Ticket system configuration
   * @param {string} config.categoryId - Category ID for tickets
   * @param {string} config.supportRoleId - Support role ID
   * @param {string} config.setupChannelId - Setup channel ID
   * @param {string} config.setupMessageId - Setup message ID
   * @returns {Promise<boolean>} Success status
   */
  async setTicketSystem(guildId, config) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!config || typeof config !== 'object') {
      throw new ValidationError('Config object is required', 'config', config);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.TicketSystem) {
        guildData.TicketSystem = {
          enabled: false,
          categoryId: null,
          supportRoleId: null,
          setupChannelId: null,
          setupMessageId: null,
          activeTickets: [],
          ticketCounter: 0
        };
      }

      // Update configuration
      if (config.categoryId !== undefined) guildData.TicketSystem.categoryId = config.categoryId;
      if (config.supportRoleId !== undefined) guildData.TicketSystem.supportRoleId = config.supportRoleId;
      if (config.setupChannelId !== undefined) guildData.TicketSystem.setupChannelId = config.setupChannelId;
      if (config.setupMessageId !== undefined) guildData.TicketSystem.setupMessageId = config.setupMessageId;
      if (config.enabled !== undefined) guildData.TicketSystem.enabled = config.enabled;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set ticket system for guild ${guildId}`, error);
    }
  }

  /**
   * Create a new ticket
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID creating the ticket
   * @param {string} channelId - Created channel ID
   * @returns {Promise<Object>} Created ticket data
   */
  async createTicket(guildId, userId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.TicketSystem) {
        guildData.TicketSystem = {
          enabled: false,
          categoryId: null,
          supportRoleId: null,
          setupChannelId: null,
          setupMessageId: null,
          activeTickets: [],
          ticketCounter: 0
        };
      }

      const activeTickets = guildData.TicketSystem.activeTickets || [];
      const ticketNumber = (guildData.TicketSystem.ticketCounter || 0) + 1;

      const ticket = {
        channelId,
        userId,
        ticketNumber,
        createdAt: new Date(),
        status: 'open',
        closedBy: null,
        closedAt: null
      };

      activeTickets.push(ticket);
      guildData.TicketSystem.activeTickets = activeTickets;
      guildData.TicketSystem.ticketCounter = ticketNumber;

      await this.set(guildId, guildData);
      return ticket;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to create ticket for guild ${guildId}`, error);
    }
  }

  /**
   * Close a ticket
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Ticket channel ID
   * @param {string} closedBy - User ID who closed the ticket
   * @returns {Promise<boolean>} Success status
   */
  async closeTicket(guildId, channelId, closedBy) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!closedBy) {
      throw new ValidationError('Closed by user ID is required', 'closedBy', closedBy);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.TicketSystem || !guildData.TicketSystem.activeTickets) {
        return false;
      }

      const activeTickets = guildData.TicketSystem.activeTickets;
      const ticketIndex = activeTickets.findIndex(t => t.channelId === channelId);

      if (ticketIndex === -1) {
        return false;
      }

      activeTickets[ticketIndex].status = 'closed';
      activeTickets[ticketIndex].closedBy = closedBy;
      activeTickets[ticketIndex].closedAt = new Date();

      guildData.TicketSystem.activeTickets = activeTickets;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to close ticket for guild ${guildId}`, error);
    }
  }

  /**
   * Get active tickets
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object[]>} Array of active tickets
   */
  async getActiveTickets(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const ticketSystem = guildData.TicketSystem || {};
      const activeTickets = ticketSystem.activeTickets || [];

      return activeTickets.filter(t => t.status === 'open');
    } catch (error) {
      console.error(`Error getting active tickets for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Get ticket by channel ID
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Ticket data or null
   */
  async getTicketByChannel(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const ticketSystem = guildData.TicketSystem || {};
      const activeTickets = ticketSystem.activeTickets || [];

      return activeTickets.find(t => t.channelId === channelId) || null;
    } catch (error) {
      console.error(`Error getting ticket by channel for guild ${guildId}:`, error.message);
      return null;
    }
  }

  // ===== VOICE MANAGER SYSTEM =====

  /**
   * Get voice manager configuration
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Voice manager configuration
   */
  async getVoiceManager(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.VoiceManager || {
        enabled: false,
        categoryId: null,
        joinChannelId: null,
        mutedChannelId: null,
        tempChannels: []
      };
    } catch (error) {
      console.error(`Error getting voice manager for guild ${guildId}:`, error.message);
      return {
        enabled: false,
        categoryId: null,
        joinChannelId: null,
        mutedChannelId: null,
        tempChannels: []
      };
    }
  }

  /**
   * Set voice manager configuration
   * @param {string} guildId - Guild ID
   * @param {Object} config - Voice manager configuration
   * @param {string} config.categoryId - Category ID for temp channels
   * @param {string} config.joinChannelId - Join to create channel ID
   * @param {string} config.mutedChannelId - Muted text channel ID
   * @returns {Promise<boolean>} Success status
   */
  async setVoiceManager(guildId, config) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!config || typeof config !== 'object') {
      throw new ValidationError('Config object is required', 'config', config);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.VoiceManager) {
        guildData.VoiceManager = {
          enabled: false,
          categoryId: null,
          joinChannelId: null,
          mutedChannelId: null,
          tempChannels: []
        };
      }

      // Update configuration
      if (config.categoryId !== undefined) guildData.VoiceManager.categoryId = config.categoryId;
      if (config.joinChannelId !== undefined) guildData.VoiceManager.joinChannelId = config.joinChannelId;
      if (config.mutedChannelId !== undefined) guildData.VoiceManager.mutedChannelId = config.mutedChannelId;
      if (config.enabled !== undefined) guildData.VoiceManager.enabled = config.enabled;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set voice manager for guild ${guildId}`, error);
    }
  }

  /**
   * Add temporary channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @param {string} ownerId - Owner user ID
   * @returns {Promise<boolean>} Success status
   */
  async addTempChannel(guildId, channelId, ownerId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!ownerId) {
      throw new ValidationError('Owner ID is required', 'ownerId', ownerId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.VoiceManager) {
        guildData.VoiceManager = {
          enabled: false,
          categoryId: null,
          joinChannelId: null,
          mutedChannelId: null,
          tempChannels: []
        };
      }

      const tempChannels = guildData.VoiceManager.tempChannels || [];

      const tempChannel = {
        channelId,
        ownerId,
        createdAt: new Date(),
        settings: {
          locked: false,
          hidden: false,
          userLimit: 0,
          rejectedUsers: [],
          permittedUsers: [],
          customName: null
        }
      };

      tempChannels.push(tempChannel);
      guildData.VoiceManager.tempChannels = tempChannels;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add temp channel for guild ${guildId}`, error);
    }
  }

  /**
   * Remove temporary channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<boolean>} Success status
   */
  async removeTempChannel(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.VoiceManager || !guildData.VoiceManager.tempChannels) {
        return false;
      }

      const tempChannels = guildData.VoiceManager.tempChannels;
      const initialLength = tempChannels.length;

      guildData.VoiceManager.tempChannels = tempChannels.filter(tc => tc.channelId !== channelId);

      if (guildData.VoiceManager.tempChannels.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove temp channel for guild ${guildId}`, error);
    }
  }

  /**
   * Get temporary channels
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object[]>} Array of temp channels
   */
  async getTempChannels(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const voiceManager = guildData.VoiceManager || {};
      return voiceManager.tempChannels || [];
    } catch (error) {
      console.error(`Error getting temp channels for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Get temporary channel by ID
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Temp channel data or null
   */
  async getTempChannel(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const voiceManager = guildData.VoiceManager || {};
      const tempChannels = voiceManager.tempChannels || [];

      return tempChannels.find(tc => tc.channelId === channelId) || null;
    } catch (error) {
      console.error(`Error getting temp channel for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Update temporary channel settings
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @param {Object} settings - Channel settings to update
   * @returns {Promise<boolean>} Success status
   */
  async updateTempChannelSettings(guildId, channelId, settings) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!settings || typeof settings !== 'object') {
      throw new ValidationError('Settings object is required', 'settings', settings);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.VoiceManager || !guildData.VoiceManager.tempChannels) {
        return false;
      }

      const tempChannels = guildData.VoiceManager.tempChannels;
      const channelIndex = tempChannels.findIndex(tc => tc.channelId === channelId);

      if (channelIndex === -1) {
        return false;
      }

      // Update settings
      tempChannels[channelIndex].settings = {
        ...tempChannels[channelIndex].settings,
        ...settings
      };

      guildData.VoiceManager.tempChannels = tempChannels;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update temp channel settings for guild ${guildId}`, error);
    }
  }

  /**
   * Setup voice manager (alias for setVoiceManager with enabled: true)
   * @param {string} guildId - Guild ID
   * @param {string} categoryId - Category ID
   * @param {string} joinChannelId - Join channel ID
   * @param {string} mutedChannelId - Muted channel ID (optional)
   * @returns {Promise<boolean>} Success status
   */
  async setupVoiceManager(guildId, categoryId, joinChannelId, mutedChannelId = null) {
    return await this.setVoiceManager(guildId, {
      enabled: true,
      categoryId,
      joinChannelId,
      mutedChannelId,
      tempChannels: []
    });
  }

  /**
   * Disable voice manager
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async disableVoiceManager(guildId) {
    return await this.setVoiceManager(guildId, {
      enabled: false,
      categoryId: null,
      joinChannelId: null,
      mutedChannelId: null,
      tempChannels: []
    });
  }

  /**
   * Add temp voice channel (alias for addTempChannel)
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @param {string} ownerId - Owner user ID
   * @returns {Promise<boolean>} Success status
   */
  async addTempVoiceChannel(guildId, channelId, ownerId) {
    return await this.addTempChannel(guildId, channelId, ownerId);
  }

  /**
   * Remove temp voice channel (alias for removeTempChannel)
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<boolean>} Success status
   */
  async removeTempVoiceChannel(guildId, channelId) {
    return await this.removeTempChannel(guildId, channelId);
  }

  /**
   * Get temp voice channel (alias for getTempChannel)
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Temp channel data or null
   */
  async getTempVoiceChannel(guildId, channelId) {
    return await this.getTempChannel(guildId, channelId);
  }

  /**
   * Update temp voice channel (alias for updateTempChannelSettings)
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @param {Object} settings - Channel settings to update
   * @returns {Promise<boolean>} Success status
   */
  async updateTempVoiceChannel(guildId, channelId, settings) {
    return await this.updateTempChannelSettings(guildId, channelId, settings);
  }

  /**
   * Transfer voice channel ownership
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @param {string} newOwnerId - New owner user ID
   * @returns {Promise<boolean>} Success status
   */
  async transferVoiceChannelOwnership(guildId, channelId, newOwnerId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!newOwnerId) {
      throw new ValidationError('New owner ID is required', 'newOwnerId', newOwnerId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.VoiceManager || !guildData.VoiceManager.tempChannels) {
        return false;
      }

      const tempChannels = guildData.VoiceManager.tempChannels;
      const channelIndex = tempChannels.findIndex(tc => tc.channelId === channelId);

      if (channelIndex === -1) {
        return false;
      }

      // Update owner
      tempChannels[channelIndex].ownerId = newOwnerId;

      guildData.VoiceManager.tempChannels = tempChannels;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to transfer voice channel ownership for guild ${guildId}`, error);
    }
  }

  /**
   * Mark invite as joined
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID who sent the invite
   * @param {string} invitedUserId - User ID who was invited
   * @returns {Promise<boolean>} Success status
   */
  async markInviteAsJoined(guildId, userId, invitedUserId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!invitedUserId) {
      throw new ValidationError('Invited user ID is required', 'invitedUserId', invitedUserId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.VoiceManager || !guildData.VoiceManager.inviteCooldowns) {
        return false;
      }

      const inviteCooldowns = guildData.VoiceManager.inviteCooldowns;
      const cooldownIndex = inviteCooldowns.findIndex(
        cd => cd.userId === userId && cd.invitedUserId === invitedUserId && !cd.hasJoined
      );

      if (cooldownIndex === -1) {
        return false;
      }

      // Mark as joined
      inviteCooldowns[cooldownIndex].hasJoined = true;

      guildData.VoiceManager.inviteCooldowns = inviteCooldowns;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to mark invite as joined for guild ${guildId}`, error);
    }
  }

  // ===== LOGGING SYSTEM =====

  /**
   * Get logging configuration
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object[]>} Array of logging configurations
   */
  async getLoggingConfig(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.LoggingConfig || [];
    } catch (error) {
      console.error(`Error getting logging config for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Set logging channel for event types
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID for logs
   * @param {string} webhookUrl - Webhook URL
   * @param {string[]} logTypes - Array of log types
   * @param {string} createdBy - User ID who created the config
   * @returns {Promise<boolean>} Success status
   */
  async setLoggingChannel(guildId, channelId, webhookUrl, logTypes, createdBy) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!webhookUrl) {
      throw new ValidationError('Webhook URL is required', 'webhookUrl', webhookUrl);
    }

    if (!Array.isArray(logTypes) || logTypes.length === 0) {
      throw new ValidationError('Log types array is required and must not be empty', 'logTypes', logTypes);
    }

    // Validate log types
    const validLogTypes = ['moderator', 'message', 'events', 'members'];
    for (const logType of logTypes) {
      if (!validLogTypes.includes(logType)) {
        throw new ValidationError(`Invalid log type: ${logType}. Must be one of: ${validLogTypes.join(', ')}`, 'logTypes', logTypes);
      }
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const loggingConfig = guildData.LoggingConfig || [];

      // Check if config for this channel already exists
      const existingIndex = loggingConfig.findIndex(lc => lc.channelId === channelId);

      const config = {
        channelId,
        webhookUrl,
        logTypes,
        enabled: true,
        createdAt: new Date(),
        createdBy: createdBy || null
      };

      if (existingIndex !== -1) {
        // Update existing config
        loggingConfig[existingIndex] = config;
      } else {
        // Add new config
        loggingConfig.push(config);
      }

      guildData.LoggingConfig = loggingConfig;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set logging channel for guild ${guildId}`, error);
    }
  }

  /**
   * Remove logging channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeLoggingChannel(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const loggingConfig = guildData.LoggingConfig || [];
      const initialLength = loggingConfig.length;

      guildData.LoggingConfig = loggingConfig.filter(lc => lc.channelId !== channelId);

      if (guildData.LoggingConfig.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove logging channel for guild ${guildId}`, error);
    }
  }

  /**
   * Clear all logging configurations
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async clearLoggingConfig(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.LoggingConfig = [];

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to clear logging config for guild ${guildId}`, error);
    }
  }

  /**
   * Get logging config for channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Logging config or null
   */
  async getLoggingConfigForChannel(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const loggingConfig = guildData.LoggingConfig || [];

      return loggingConfig.find(lc => lc.channelId === channelId) || null;
    } catch (error) {
      console.error(`Error getting logging config for channel in guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Update logging config enabled status
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @param {boolean} enabled - Enabled status
   * @returns {Promise<boolean>} Success status
   */
  async setLoggingEnabled(guildId, channelId, enabled) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (typeof enabled !== 'boolean') {
      throw new ValidationError('Enabled must be a boolean', 'enabled', enabled);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const loggingConfig = guildData.LoggingConfig || [];
      const configIndex = loggingConfig.findIndex(lc => lc.channelId === channelId);

      if (configIndex === -1) {
        return false;
      }

      loggingConfig[configIndex].enabled = enabled;
      guildData.LoggingConfig = loggingConfig;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set logging enabled for guild ${guildId}`, error);
    }
  }

  /**
   * Get logging configs for a specific log type
   * @param {string} guildId - Guild ID
   * @param {string} logType - Log type (moderator, message, events, members)
   * @returns {Promise<Object[]>} Array of logging configs that include this log type
   */
  async getLoggingConfigsForType(guildId, logType) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!logType) {
      throw new ValidationError('Log type is required', 'logType', logType);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const loggingConfig = guildData.LoggingConfig || [];

      // Filter configs that:
      // 1. Are enabled
      // 2. Include the requested log type
      return loggingConfig.filter(config =>
        config.enabled &&
        config.logTypes &&
        config.logTypes.includes(logType)
      );
    } catch (error) {
      console.error(`Error getting logging configs for type ${logType} in guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Update logging config by channel ID (for webhook recreation)
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @param {Object} updates - Updates to apply (typically new webhookUrl)
   * @returns {Promise<boolean>} Success status
   */
  async updateLoggingConfigByChannel(guildId, channelId, updates) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!updates || typeof updates !== 'object') {
      throw new ValidationError('Updates object is required', 'updates', updates);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const loggingConfig = guildData.LoggingConfig || [];

      // Find existing config by channel ID
      const configIndex = loggingConfig.findIndex(config => config.channelId === channelId);

      if (configIndex !== -1) {
        // Apply updates while preserving existing data
        loggingConfig[configIndex] = {
          ...loggingConfig[configIndex],
          ...updates,
          channelId, // Preserve channel ID
          updatedAt: new Date()
        };

        guildData.LoggingConfig = loggingConfig;
        await this.set(guildId, guildData);
        return true;
      }

      return false; // Config not found
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update logging config by channel for guild ${guildId}`, error);
    }
  }

  // ===== BOOSTER ROLE SYSTEM =====

  /**
   * Get booster role system configuration
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Booster role system config
   */
  async getBoosterRoleSystem(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.BoosterRoleSystem || {
        baseRoleId: null,
        enabled: false
      };
    } catch (error) {
      console.error(`Error getting booster role system for guild ${guildId}:`, error.message);
      return {
        baseRoleId: null,
        enabled: false
      };
    }
  }

  /**
   * Set booster role system configuration
   * @param {string} guildId - Guild ID
   * @param {string} baseRoleId - Base role ID for positioning
   * @param {boolean} enabled - Whether system is enabled
   * @returns {Promise<boolean>} Success status
   */
  async setBoosterRoleSystem(guildId, baseRoleId, enabled) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof enabled !== 'boolean') {
      throw new ValidationError('Enabled must be a boolean', 'enabled', enabled);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.BoosterRoleSystem) {
        guildData.BoosterRoleSystem = {
          baseRoleId: null,
          enabled: false
        };
      }

      guildData.BoosterRoleSystem.baseRoleId = baseRoleId;
      guildData.BoosterRoleSystem.enabled = enabled;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set booster role system for guild ${guildId}`, error);
    }
  }

  /**
   * Add booster role
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID (owner)
   * @param {string} roleId - Role ID
   * @param {string} name - Role name
   * @param {string} color - Role color (hex)
   * @param {string} icon - Role icon
   * @returns {Promise<Object>} Created booster role
   */
  async addBoosterRole(guildId, userId, roleId, name, color = null, icon = null) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!roleId) {
      throw new ValidationError('Role ID is required', 'roleId', roleId);
    }

    if (!name || name.trim().length === 0) {
      throw new ValidationError('Role name is required', 'name', name);
    }

    if (name.length > 100) {
      throw new ValidationError('Role name cannot exceed 100 characters', 'name', name);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boosterRoles = guildData.BoosterRoles || [];

      const boosterRole = {
        userId,
        ownerId: userId, // For backward compatibility
        roleId,
        name: name.trim(),
        color,
        icon,
        sharedWith: [],
        createdAt: new Date(),
        lastModified: new Date()
      };

      boosterRoles.push(boosterRole);
      guildData.BoosterRoles = boosterRoles;

      await this.set(guildId, guildData);
      return boosterRole;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add booster role for guild ${guildId}`, error);
    }
  }

  /**
   * Remove booster role
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID (owner)
   * @returns {Promise<boolean>} Success status
   */
  async removeBoosterRole(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boosterRoles = guildData.BoosterRoles || [];
      const initialLength = boosterRoles.length;

      // Handle both userId and ownerId for backward compatibility
      guildData.BoosterRoles = boosterRoles.filter(br => br.userId !== userId && br.ownerId !== userId);

      if (guildData.BoosterRoles.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove booster role for guild ${guildId}`, error);
    }
  }

  /**
   * Get booster roles
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object[]>} Array of booster roles
   */
  async getBoosterRoles(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.BoosterRoles || [];
    } catch (error) {
      console.error(`Error getting booster roles for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Get booster role by user ID
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID (owner)
   * @returns {Promise<Object|null>} Booster role or null
   */
  async getBoosterRoleByUser(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boosterRoles = guildData.BoosterRoles || [];

      // Handle both userId and ownerId for backward compatibility
      return boosterRoles.find(br => br.userId === userId || br.ownerId === userId) || null;
    } catch (error) {
      console.error(`Error getting booster role by user for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Update booster role
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID (owner)
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>} Success status
   */
  async updateBoosterRole(guildId, userId, updates) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!updates || typeof updates !== 'object') {
      throw new ValidationError('Updates object is required', 'updates', updates);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boosterRoles = guildData.BoosterRoles || [];

      // Handle both userId and ownerId for backward compatibility
      const roleIndex = boosterRoles.findIndex(br => br.userId === userId || br.ownerId === userId);

      if (roleIndex === -1) {
        return false;
      }

      // Update fields
      boosterRoles[roleIndex] = {
        ...boosterRoles[roleIndex],
        ...updates,
        lastModified: new Date()
      };

      guildData.BoosterRoles = boosterRoles;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update booster role for guild ${guildId}`, error);
    }
  }

  // ===== AFK SYSTEM =====

  /**
   * Set user AFK status
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {string} reason - AFK reason/message
   * @returns {Promise<boolean>} Success status
   */
  async setUserAFK(guildId, userId, reason = 'AFK') {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const afkList = guildData.AFK || [];

      // Remove existing AFK status if present
      const filteredList = afkList.filter(afk => afk.userId !== userId);

      // Add new AFK status
      filteredList.push({
        userId,
        message: reason || 'AFK',
        since: new Date()
      });

      guildData.AFK = filteredList;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set AFK status for user ${userId} in guild ${guildId}`, error);
    }
  }

  /**
   * Remove user AFK status
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async removeUserAFK(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const afkList = guildData.AFK || [];
      const initialLength = afkList.length;

      guildData.AFK = afkList.filter(afk => afk.userId !== userId);

      if (guildData.AFK.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove AFK status for user ${userId} in guild ${guildId}`, error);
    }
  }

  /**
   * Get user AFK status
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} AFK data or null
   */
  async getUserAFK(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const afkList = guildData.AFK || [];

      return afkList.find(afk => afk.userId === userId) || null;
    } catch (error) {
      console.error(`Error getting AFK status for user ${userId} in guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Get all AFK users
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object[]>} Array of AFK users
   */
  async getAllAFK(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.AFK || [];
    } catch (error) {
      console.error(`Error getting all AFK users for guild ${guildId}:`, error.message);
      return [];
    }
  }

  // ===== FORCE NICK SYSTEM =====

  /**
   * Add forced nickname
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {string} nickname - Forced nickname
   * @param {string} setBy - User ID who set the force nick
   * @returns {Promise<boolean>} Success status
   */
  async addForceNick(guildId, userId, nickname, setBy) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!nickname || nickname.trim().length === 0) {
      throw new ValidationError('Nickname is required', 'nickname', nickname);
    }

    if (nickname.length > 32) {
      throw new ValidationError('Nickname cannot exceed 32 characters (Discord limit)', 'nickname', nickname);
    }

    if (!setBy) {
      throw new ValidationError('Set by user ID is required', 'setBy', setBy);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const forceNicks = guildData.ForceNick || [];

      // Remove existing force nick if present
      const filteredList = forceNicks.filter(fn => fn.userId !== userId);

      // Add new force nick
      filteredList.push({
        userId,
        nickname: nickname.trim(),
        setBy,
        setAt: new Date()
      });

      guildData.ForceNick = filteredList;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add force nick for user ${userId} in guild ${guildId}`, error);
    }
  }

  /**
   * Remove forced nickname
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async removeForceNick(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const forceNicks = guildData.ForceNick || [];
      const initialLength = forceNicks.length;

      guildData.ForceNick = forceNicks.filter(fn => fn.userId !== userId);

      if (guildData.ForceNick.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove force nick for user ${userId} in guild ${guildId}`, error);
    }
  }

  /**
   * Get forced nickname
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Force nick data or null
   */
  async getForceNick(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const forceNicks = guildData.ForceNick || [];

      return forceNicks.find(fn => fn.userId === userId) || null;
    } catch (error) {
      console.error(`Error getting force nick for user ${userId} in guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Get all forced nicknames
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object[]>} Array of forced nicknames
   */
  async getAllForceNicks(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.ForceNick || [];
    } catch (error) {
      console.error(`Error getting all force nicks for guild ${guildId}:`, error.message);
      return [];
    }
  }

  // ===== LOGGING SYSTEM EXTENDED =====

  /**
   * Valid event types for logging
   * @private
   * @returns {string[]} Array of valid event types
   */
  getValidLoggingEventTypes() {
    return [
      'messageDelete',
      'messageUpdate',
      'memberJoin',
      'memberLeave',
      'memberBan',
      'memberUnban',
      'roleCreate',
      'roleDelete',
      'roleUpdate',
      'channelCreate',
      'channelDelete',
      'channelUpdate',
      'voiceStateUpdate',
      'guildUpdate',
      'emojiCreate',
      'emojiDelete',
      'emojiUpdate'
    ];
  }

  /**
   * Add logging configuration
   * @param {string} guildId - Guild ID
   * @param {string} eventType - Event type to log
   * @param {string} channelId - Log channel ID
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} Success status
   */
  async addLoggingConfig(guildId, eventType, channelId, options = {}) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!eventType) {
      throw new ValidationError('Event type is required', 'eventType', eventType);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    // Validate event type
    const validEventTypes = this.getValidLoggingEventTypes();
    if (!validEventTypes.includes(eventType)) {
      throw new ValidationError(
        `Invalid event type. Must be one of: ${validEventTypes.join(', ')}`,
        'eventType',
        eventType
      );
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      let loggingConfig = guildData.LoggingConfig || [];

      // Check if config already exists for this event type
      const existingIndex = loggingConfig.findIndex(config => config.eventType === eventType);

      if (existingIndex !== -1) {
        // Update existing config
        loggingConfig[existingIndex] = {
          eventType,
          channelId,
          enabled: true,
          options: options || {},
          createdAt: loggingConfig[existingIndex].createdAt || new Date(),
          updatedAt: new Date()
        };
      } else {
        // Add new config
        loggingConfig.push({
          eventType,
          channelId,
          enabled: true,
          options: options || {},
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      guildData.LoggingConfig = loggingConfig;
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add logging config for guild ${guildId}`, error);
    }
  }

  /**
   * Update logging configuration
   * @param {string} guildId - Guild ID
   * @param {string} eventType - Event type
   * @param {Object} updates - Updates to apply
   * @returns {Promise<boolean>} Success status
   */
  async updateLoggingConfig(guildId, eventType, updates) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!eventType) {
      throw new ValidationError('Event type is required', 'eventType', eventType);
    }

    if (!updates || typeof updates !== 'object') {
      throw new ValidationError('Updates object is required', 'updates', updates);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      let loggingConfig = guildData.LoggingConfig || [];

      // Find existing config by event type
      const configIndex = loggingConfig.findIndex(config => config.eventType === eventType);

      if (configIndex !== -1) {
        // Apply updates
        loggingConfig[configIndex] = {
          ...loggingConfig[configIndex],
          ...updates,
          eventType, // Preserve event type
          updatedAt: new Date()
        };

        guildData.LoggingConfig = loggingConfig;
        await this.set(guildId, guildData);
        return true;
      }

      return false; // Config not found
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update logging config for guild ${guildId}`, error);
    }
  }

  /**
   * Remove logging configuration
   * @param {string} guildId - Guild ID
   * @param {string} eventType - Event type
   * @returns {Promise<boolean>} Success status
   */
  async removeLoggingConfig(guildId, eventType) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!eventType) {
      throw new ValidationError('Event type is required', 'eventType', eventType);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const loggingConfig = guildData.LoggingConfig || [];
      const initialLength = loggingConfig.length;

      guildData.LoggingConfig = loggingConfig.filter(config => config.eventType !== eventType);

      if (guildData.LoggingConfig.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false; // Config not found
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove logging config for guild ${guildId}`, error);
    }
  }

  // ===== TICKET SYSTEM EXTENDED =====

  /**
   * Enable ticket system
   * @param {string} guildId - Guild ID
   * @param {string} categoryId - Category ID
   * @param {string} supportRoleId - Support role ID
   * @returns {Promise<boolean>} Success status
   */
  async enableTicketSystem(guildId, categoryId = null, supportRoleId = null) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.TicketSystem) {
        guildData.TicketSystem = {
          enabled: false,
          categoryId: null,
          supportRoleId: null,
          setupChannelId: null,
          setupMessageId: null,
          activeTickets: [],
          ticketCounter: 0
        };
      }

      guildData.TicketSystem.enabled = true;
      if (categoryId !== undefined) {
        guildData.TicketSystem.categoryId = categoryId;
      }
      if (supportRoleId !== undefined) {
        guildData.TicketSystem.supportRoleId = supportRoleId;
      }

      // Initialize activeTickets if needed
      if (!guildData.TicketSystem.activeTickets) {
        guildData.TicketSystem.activeTickets = [];
      }

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to enable ticket system for guild ${guildId}`, error);
    }
  }

  /**
   * Set ticket category
   * @param {string} guildId - Guild ID
   * @param {string} categoryId - Category ID
   * @returns {Promise<boolean>} Success status
   */
  async setTicketCategory(guildId, categoryId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!categoryId) {
      throw new ValidationError('Category ID is required', 'categoryId', categoryId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.TicketSystem) {
        guildData.TicketSystem = {
          enabled: false,
          categoryId: null,
          supportRoleId: null,
          setupChannelId: null,
          setupMessageId: null,
          activeTickets: [],
          ticketCounter: 0
        };
      }

      guildData.TicketSystem.categoryId = categoryId;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set ticket category for guild ${guildId}`, error);
    }
  }

  /**
   * Set ticket setup channel and message
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Setup channel ID
   * @param {string} messageId - Setup message ID
   * @returns {Promise<boolean>} Success status
   */
  async setTicketSetup(guildId, channelId, messageId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.TicketSystem) {
        guildData.TicketSystem = {
          enabled: false,
          categoryId: null,
          supportRoleId: null,
          setupChannelId: null,
          setupMessageId: null,
          activeTickets: [],
          ticketCounter: 0
        };
      }

      guildData.TicketSystem.setupChannelId = channelId;
      guildData.TicketSystem.setupMessageId = messageId;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set ticket setup for guild ${guildId}`, error);
    }
  }

  /**
   * Set ticket support role
   * @param {string} guildId - Guild ID
   * @param {string} roleId - Support role ID
   * @returns {Promise<boolean>} Success status
   */
  async setTicketSupportRole(guildId, roleId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!roleId) {
      throw new ValidationError('Role ID is required', 'roleId', roleId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.TicketSystem) {
        guildData.TicketSystem = {
          enabled: false,
          categoryId: null,
          supportRoleId: null,
          setupChannelId: null,
          setupMessageId: null,
          activeTickets: [],
          ticketCounter: 0
        };
      }

      guildData.TicketSystem.supportRoleId = roleId;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set ticket support role for guild ${guildId}`, error);
    }
  }

  /**
   * Set custom ticket message
   * @param {string} guildId - Guild ID
   * @param {string} message - Custom ticket message
   * @returns {Promise<boolean>} Success status
   */
  async setTicketCustomMessage(guildId, message) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!message || message.trim().length === 0) {
      throw new ValidationError('Custom message is required', 'message', message);
    }

    if (message.trim().length > 2000) {
      throw new ValidationError('Custom message cannot exceed 2000 characters', 'message', message);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.TicketSystem) {
        guildData.TicketSystem = {
          enabled: false,
          categoryId: null,
          supportRoleId: null,
          setupChannelId: null,
          setupMessageId: null,
          customMessage: null,
          activeTickets: [],
          ticketCounter: 0
        };
      }

      guildData.TicketSystem.customMessage = message.trim();

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set custom ticket message for guild ${guildId}`, error);
    }
  }

  /**
   * Get custom ticket message
   * @param {string} guildId - Guild ID
   * @returns {Promise<string|null>} Custom message or null
   */
  async getTicketCustomMessage(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return guildData.TicketSystem?.customMessage || null;
    } catch (error) {
      console.error(`Error getting custom ticket message for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Remove custom ticket message
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async removeTicketCustomMessage(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.TicketSystem) {
        return false; // No ticket system exists
      }

      guildData.TicketSystem.customMessage = null;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove custom ticket message for guild ${guildId}`, error);
    }
  }

  /**
   * Get ticket by channel ID
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Ticket channel ID
   * @returns {Promise<Object|null>} Ticket data or null
   */
  async getTicket(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const ticketSystem = guildData.TicketSystem || {};
      const activeTickets = ticketSystem.activeTickets || [];

      return activeTickets.find(ticket => ticket.channelId === channelId) || null;
    } catch (error) {
      console.error(`Error getting ticket for channel ${channelId} in guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Get all tickets for a specific user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of user's tickets
   */
  async getUserTickets(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const ticketSystem = guildData.TicketSystem || {};
      const activeTickets = ticketSystem.activeTickets || [];

      // Return all tickets for this user that are not closed
      return activeTickets.filter(ticket => ticket.userId === userId && ticket.status !== 'closed');
    } catch (error) {
      console.error(`Error getting tickets for user ${userId} in guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Remove a ticket from the database
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Ticket channel ID
   * @returns {Promise<boolean>} Success status
   */
  async removeTicket(guildId, channelId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const ticketSystem = guildData.TicketSystem || {};
      let activeTickets = ticketSystem.activeTickets || [];

      // Remove ticket by channel ID
      activeTickets = activeTickets.filter(ticket => ticket.channelId !== channelId);

      guildData.TicketSystem.activeTickets = activeTickets;
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove ticket for guild ${guildId}`, error);
    }
  }

  /**
   * Reopen a closed ticket
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Ticket channel ID
   * @param {string} reopenedBy - User ID who reopened
   * @returns {Promise<boolean>} Success status
   */
  async reopenTicket(guildId, channelId, reopenedBy) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!channelId) {
      throw new ValidationError('Channel ID is required', 'channelId', channelId);
    }

    if (!reopenedBy) {
      throw new ValidationError('Reopened by user ID is required', 'reopenedBy', reopenedBy);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const ticketSystem = guildData.TicketSystem || {};
      let activeTickets = ticketSystem.activeTickets || [];

      // Find ticket by channel ID
      const ticketIndex = activeTickets.findIndex(ticket => ticket.channelId === channelId);

      if (ticketIndex !== -1) {
        // Reopen the ticket
        activeTickets[ticketIndex].closed = false;
        activeTickets[ticketIndex].reopenedAt = new Date();
        activeTickets[ticketIndex].reopenedBy = reopenedBy;

        guildData.TicketSystem.activeTickets = activeTickets;
        await this.set(guildId, guildData);
        return true;
      }

      return false; // Ticket not found
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to reopen ticket for channel ${channelId} in guild ${guildId}`, error);
    }
  }

  // ===== BOOSTER ROLE SYSTEM EXTENDED =====

  /**
   * Get booster role base role ID
   * @param {string} guildId - Guild ID
   * @returns {Promise<string|null>} Base role ID or null
   */
  async getBoosterRoleBaseRole(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boosterSystem = guildData.BoosterRoleSystem || {};
      return boosterSystem.baseRoleId || null;
    } catch (error) {
      console.error(`Error getting booster role base role for guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Set booster role base role
   * @param {string} guildId - Guild ID
   * @param {string} roleId - Base role ID
   * @returns {Promise<boolean>} Success status
   */
  async setBoosterRoleBaseRole(guildId, roleId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!roleId) {
      throw new ValidationError('Role ID is required', 'roleId', roleId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);

      if (!guildData.BoosterRoleSystem) {
        guildData.BoosterRoleSystem = {
          baseRoleId: null,
          enabled: false
        };
      }

      guildData.BoosterRoleSystem.baseRoleId = roleId;
      guildData.BoosterRoleSystem.enabled = true; // Enable system when base role is set

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set booster role base role for guild ${guildId}`, error);
    }
  }

  /**
   * Check if booster role system is enabled
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} True if enabled
   */
  async isBoosterRoleSystemEnabled(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boosterSystem = guildData.BoosterRoleSystem || {};
      return boosterSystem.enabled || false;
    } catch (error) {
      console.error(`Error checking booster role system status for guild ${guildId}:`, error.message);
      return false;
    }
  }

  /**
   * Add pending booster role share
   * @param {string} guildId - Guild ID
   * @param {string} userId - Owner user ID
   * @param {string} targetUserId - Target user ID
   * @param {string} roleId - Role ID
   * @returns {Promise<Object>} Created pending share
   */
  async addBoosterRolePendingShare(guildId, userId, targetUserId, roleId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!targetUserId) {
      throw new ValidationError('Target user ID is required', 'targetUserId', targetUserId);
    }

    if (!roleId) {
      throw new ValidationError('Role ID is required', 'roleId', roleId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      let boosterRoles = guildData.BoosterRoles || [];

      // Generate unique ID
      const id = boosterRoles.length > 0
        ? Math.max(...boosterRoles.filter(br => br.id).map(br => br.id)) + 1
        : 1;

      // Create pending share with 24-hour expiration
      const pendingShare = {
        id,
        userId,
        targetUserId,
        roleId,
        pending: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };

      boosterRoles.push(pendingShare);
      guildData.BoosterRoles = boosterRoles;

      await this.set(guildId, guildData);
      return pendingShare;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add booster role pending share for guild ${guildId}`, error);
    }
  }

  /**
   * Remove pending booster role share
   * @param {string} guildId - Guild ID
   * @param {number} shareId - Share ID
   * @returns {Promise<boolean>} Success status
   */
  async removeBoosterRolePendingShare(guildId, shareId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof shareId !== 'number' || shareId < 1) {
      throw new ValidationError('Valid share ID is required', 'shareId', shareId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boosterRoles = guildData.BoosterRoles || [];
      const initialLength = boosterRoles.length;

      guildData.BoosterRoles = boosterRoles.filter(br => !(br.pending && br.id === shareId));

      if (guildData.BoosterRoles.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false; // Pending share not found
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove booster role pending share for guild ${guildId}`, error);
    }
  }

  /**
   * Delete booster role
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteBoosterRole(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      let boosterRoles = guildData.BoosterRoles || [];

      // Find booster role by userId
      const roleIndex = boosterRoles.findIndex(br => br.userId === userId && !br.deleted);

      if (roleIndex !== -1) {
        // Mark as deleted with timestamp (keep for audit trail)
        boosterRoles[roleIndex].deleted = true;
        boosterRoles[roleIndex].deletedAt = new Date();

        guildData.BoosterRoles = boosterRoles;
        await this.set(guildId, guildData);
        return true;
      }

      return false; // Booster role not found
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to delete booster role for user ${userId} in guild ${guildId}`, error);
    }
  }

  /**
   * Get unused booster roles
   * @param {string} guildId - Guild ID
   * @param {number} daysSinceLastUsed - Number of days since last used (optional, default 30)
   * @returns {Promise<Object[]>} Array of unused roles
   */
  async getUnusedBoosterRoles(guildId, daysSinceLastUsed = 30) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (typeof daysSinceLastUsed !== 'number' || daysSinceLastUsed < 1) {
      daysSinceLastUsed = 30;
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boosterRoles = guildData.BoosterRoles || [];
      const cutoffDate = new Date(Date.now() - (daysSinceLastUsed * 24 * 60 * 60 * 1000));

      // Filter for roles that are:
      // 1. Marked as deleted, OR
      // 2. Don't have a userId, OR  
      // 3. Haven't been used in the specified number of days
      return boosterRoles.filter(br => {
        if (br.deleted === true || !br.userId) {
          return true;
        }
        
        // Check if role hasn't been used recently
        const lastUsed = br.lastUsed || br.lastModified || br.createdAt;
        if (!lastUsed) {
          return true; // No usage data, consider it unused
        }
        
        return new Date(lastUsed) < cutoffDate;
      });
    } catch (error) {
      console.error(`Error getting unused booster roles for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Get user's booster role
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Booster role or null
   */
  async getUserBoosterRole(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const boosterRoles = guildData.BoosterRoles || [];

      // Find active (not deleted) booster role for user
      return boosterRoles.find(br => br.userId === userId && !br.deleted) || null;
    } catch (error) {
      console.error(`Error getting booster role for user ${userId} in guild ${guildId}:`, error.message);
      return null;
    }
  }

  // ===== AFK SYSTEM =====

  /**
   * Get AFK status for a user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} AFK status or null
   */
  async getAFKStatus(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const afkArray = guildData.AFK || [];

      return afkArray.find(afk => afk.userId === userId) || null;
    } catch (error) {
      console.error(`Error getting AFK status for user ${userId} in guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Set AFK status for a user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {string} reason - AFK reason
   * @returns {Promise<boolean>} Success status
   */
  async setAFKStatus(guildId, userId, reason) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new ValidationError('AFK reason is required', 'reason', reason);
    }

    if (reason.length > 500) {
      throw new ValidationError('AFK reason cannot exceed 500 characters', 'reason', reason);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      let afkArray = guildData.AFK || [];

      // Check if user already has AFK status
      const existingIndex = afkArray.findIndex(afk => afk.userId === userId);

      if (existingIndex !== -1) {
        // Update existing AFK status
        afkArray[existingIndex] = {
          userId,
          message: reason.trim(),
          since: new Date()
        };
      } else {
        // Add new AFK status
        afkArray.push({
          userId,
          message: reason.trim(),
          since: new Date()
        });
      }

      guildData.AFK = afkArray;
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set AFK status for user ${userId} in guild ${guildId}`, error);
    }
  }

  /**
   * Remove AFK status for a user
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async removeAFKStatus(guildId, userId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const afkArray = guildData.AFK || [];
      const initialLength = afkArray.length;

      guildData.AFK = afkArray.filter(afk => afk.userId !== userId);

      if (guildData.AFK.length < initialLength) {
        await this.set(guildId, guildData);
        return true;
      }

      return false; // User was not AFK
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove AFK status for user ${userId} in guild ${guildId}`, error);
    }
  }

  // ===== BOOST ROLE SYSTEM =====

  /**
   * Set boost role
   * @param {string} guildId - Guild ID
   * @param {string} roleId - Boost role ID
   * @returns {Promise<boolean>} Success status
   */
  async setBoostRole(guildId, roleId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!roleId) {
      throw new ValidationError('Role ID is required', 'roleId', roleId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.BoostRole = roleId;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set boost role for guild ${guildId}`, error);
    }
  }

  /**
   * Remove boost role
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async removeBoostRole(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.BoostRole = null;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to remove boost role for guild ${guildId}`, error);
    }
  }

  // ===== VANITY SYSTEM EXTENDED =====

  /**
   * Enable vanity system
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async enableVanity(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.VanityDisabled = false;
      guildData.VanityDisabledReason = null;
      guildData.VanityDisabledAt = null;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to enable vanity for guild ${guildId}`, error);
    }
  }

  /**
   * Set vanity log message
   * @param {string} guildId - Guild ID
   * @param {string} message - Vanity message
   * @returns {Promise<boolean>} Success status
   */
  async setVanityMessage(guildId, message) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new ValidationError('Vanity message is required', 'message', message);
    }

    if (message.length > 2000) {
      throw new ValidationError('Vanity message cannot exceed 2000 characters', 'message', message);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.VanityMessage = message.trim();

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set vanity message for guild ${guildId}`, error);
    }
  }

  /**
   * Remove vanity message
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async removeVanityMessage(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.VanityMessage = null;

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to remove vanity message for guild ${guildId}`, error);
    }
  }

  /**
   * Get vanity disabled information
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Disabled info
   */
  async getVanityDisabledInfo(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      return {
        disabled: guildData.VanityDisabled || false,
        reason: guildData.VanityDisabledReason || null,
        disabledAt: guildData.VanityDisabledAt || null,
        disabledBy: guildData.VanityDisabledBy || null
      };
    } catch (error) {
      console.error(`Error getting vanity disabled info for guild ${guildId}:`, error.message);
      return {
        disabled: false,
        reason: null,
        disabledAt: null,
        disabledBy: null
      };
    }
  }

  // ===== GUILD NAME HISTORY =====

  /**
   * Add guild name change to history
   * @param {string} guildId - Guild ID
   * @param {string} oldName - Old guild name
   * @param {string} newName - New guild name
   * @param {string|null} changedBy - User ID who changed the name (null if unknown)
   * @returns {Promise<Object>} Created history entry
   */
  async addGuildNameChange(guildId, oldName, newName, changedBy = null) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!oldName || typeof oldName !== 'string') {
      throw new ValidationError('Old name is required', 'oldName', oldName);
    }

    if (!newName || typeof newName !== 'string') {
      throw new ValidationError('New name is required', 'newName', newName);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const history = guildData.GuildNameHistory || [];

      const historyEntry = {
        oldName: oldName.trim(),
        newName: newName.trim(),
        changedBy: changedBy || null,
        changedAt: new Date()
      };

      // Check if this exact change already exists as the most recent entry
      if (history.length > 0) {
        const mostRecent = history[history.length - 1];
        if (mostRecent.oldName === historyEntry.oldName &&
          mostRecent.newName === historyEntry.newName) {
          // Don't add duplicate consecutive changes
          return mostRecent;
        }
      }

      history.push(historyEntry);
      guildData.GuildNameHistory = history;

      await this.set(guildId, guildData);
      return historyEntry;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add guild name change for guild ${guildId}`, error);
    }
  }

  /**
   * Get guild name history
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object[]>} Array of name history
   */
  async getGuildNameHistory(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const history = guildData.GuildNameHistory || [];

      // Sort by changedAt descending (newest first)
      return history.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
    } catch (error) {
      console.error(`Error getting guild name history for guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Clear all guild name history
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async clearAllGuildNameHistory(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.GuildNameHistory = [];

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to clear guild name history for guild ${guildId}`, error);
    }
  }

  // ===== FORCE NICK SYSTEM EXTENDED =====

  /**
   * Set forced nickname
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {string} nickname - Forced nickname
   * @param {string} reason - Optional reason
   * @returns {Promise<boolean>} Success status
   */
  async setForceNick(guildId, userId, nickname, reason = null) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      throw new ValidationError('Nickname is required', 'nickname', nickname);
    }

    if (nickname.length > 32) {
      throw new ValidationError('Nickname cannot exceed 32 characters', 'nickname', nickname);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      let forceNicks = guildData.ForceNick || [];

      // Check if user already has forced nick
      const existingIndex = forceNicks.findIndex(fn => fn.userId === userId);

      if (existingIndex !== -1) {
        // Update existing forced nick
        forceNicks[existingIndex] = {
          userId,
          nickname: nickname.trim(),
          reason: reason ? reason.trim() : null,
          setAt: new Date(),
          setBy: null // Can be enhanced to track who set it
        };
      } else {
        // Add new forced nick
        forceNicks.push({
          userId,
          nickname: nickname.trim(),
          reason: reason ? reason.trim() : null,
          setAt: new Date(),
          setBy: null
        });
      }

      guildData.ForceNick = forceNicks;
      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set forced nickname for user ${userId} in guild ${guildId}`, error);
    }
  }

  /**
   * Clear all forced nicknames
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async clearAllForceNicks(guildId) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      guildData.ForceNick = [];

      await this.set(guildId, guildData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to clear all forced nicknames for guild ${guildId}`, error);
    }
  }

  // ===== AUTO RESPONDER HELPER =====

  /**
   * Find auto responder by trigger
   * @param {string} guildId - Guild ID
   * @param {string} trigger - Trigger text
   * @returns {Promise<Object|null>} Auto responder or null
   */
  async findAutoResponder(guildId, trigger) {
    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!trigger || typeof trigger !== 'string') {
      throw new ValidationError('Trigger is required', 'trigger', trigger);
    }

    try {
      const guildData = await this.ensureGuildData(guildId);
      const autoResponders = guildData.AutoResponder || [];

      // Perform case-insensitive search
      const triggerLower = trigger.toLowerCase();
      return autoResponders.find(ar => ar.trigger && ar.trigger.toLowerCase() === triggerLower) || null;
    } catch (error) {
      console.error(`Error finding auto responder for guild ${guildId}:`, error.message);
      return null;
    }
  }

  // ===== REQUIRED EXPERIENCE HELPER =====

  /**
   * Get required experience for level
   * @param {number} level - Level number
   * @returns {number} Required experience
   */
  getRequiredExperience(level) {
    if (typeof level !== 'number' || level < 1) {
      throw new ValidationError('Level must be a positive number', 'level', level);
    }

    // Standard RPG progression formula
    // Level 1->2: 100 XP
    // Level 2->3: 155 XP
    // Level 3->4: 220 XP
    // Formula: 100 * level * (1 + level * 0.1)
    return Math.floor(100 * level * (1 + level * 0.1));
  }
}

module.exports = GuildService;
