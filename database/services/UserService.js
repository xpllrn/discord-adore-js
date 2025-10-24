const BaseService = require('./core/BaseService');
const { ValidationError, NotFoundError, DatabaseWriteError } = require('./core/errors');

/**
 * User Service
 * Handles all user-related data operations with intelligent caching
 * All time-sensitive fields use UTC standardization
 */
class UserService extends BaseService {
  constructor() {
    super({
      modelName: 'User',
      keyField: 'UserID',
      database: 'global',
      ttl: 45 * 60 * 1000, // 45 minutes TTL for user data
      maxSize: 10000 // Max 10000 users in cache
    });
    
    this.initialized = true;
  }

  // ===== DATABASE OPERATIONS (BaseService Implementation) =====

  /**
   * Write user data to database
   * @param {string} key - User ID
   * @param {Object} data - User data
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
      throw new DatabaseWriteError(`Failed to write user data for ${key}`, error);
    }
  }

  /**
   * Read user data from database
   * @param {string} key - User ID
   * @returns {Promise<Object|null>} User data or null
   */
  async readFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      const doc = await Model.findOne(query).lean();
      return doc || null;
    } catch (error) {
      console.error(`Error reading user data for ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Delete user data from database
   * @param {string} key - User ID
   * @returns {Promise<void>}
   */
  async deleteFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      await Model.deleteOne(query);
    } catch (error) {
      throw new DatabaseWriteError(`Failed to delete user data for ${key}`, error);
    }
  }

  /**
   * Batch read user data from database
   * @param {string[]} keys - Array of user IDs
   * @returns {Promise<Map<string, Object>>} Map of user ID to user data
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
      console.error('Error batch reading user data:', error.message);
      return new Map();
    }
  }

  // ===== USER DATA OPERATIONS =====

  /**
   * Ensure user data exists with default values
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User data
   */
  async ensureUserData(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      // Try to get existing data first
      let userData = await this.get(userId);

      if (!userData) {
        // Create default user data with UTC timestamps
        userData = {
          UserID: userId,
          SelfPrefix: null,
          Gambling: {
            wallet: 1000,
            bank: 0,
            dailyClaim: {
              lastClaimed: null,
              streak: 0
            },
            robCooldown: null,
            lastWorked: null,
            begCooldown: null,
            lastInterestClaim: null,
            totalGambled: 0,
            totalWon: 0,
            totalLost: 0
          },
          LastFMUsername: null,
          LastFMLibrary: {
            artists: [],
            albums: [],
            tracks: []
          },
          LastFMSettings: {},
          Roleplay: {
            given: [],
            received: []
          },
          Notes: [],
          NameHistory: [],
          Birthday: {
            day: null,
            month: null,
            setAt: null
          },
          Timezone: null,
          TicTacToe: {
            wins: 0,
            losses: 0,
            draws: 0
          },
          Reminders: []
        };

        // Save to database and cache
        await this.set(userId, userData);
      }

      return userData;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to ensure user data for ${userId}`, error);
    }
  }

  // ===== GAMBLING SYSTEM =====

  /**
   * Get gambling data for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Gambling data
   */
  async getGamblingData(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      return userData.Gambling || {
        wallet: 1000,
        bank: 0,
        dailyClaim: { lastClaimed: null, streak: 0 },
        robCooldown: null,
        lastWorked: null,
        begCooldown: null,
        lastInterestClaim: null,
        totalGambled: 0,
        totalWon: 0,
        totalLost: 0
      };
    } catch (error) {
      console.error(`Error getting gambling data for user ${userId}:`, error.message);
      return {
        wallet: 1000,
        bank: 0,
        dailyClaim: { lastClaimed: null, streak: 0 },
        robCooldown: null,
        lastWorked: null,
        begCooldown: null,
        lastInterestClaim: null,
        totalGambled: 0,
        totalWon: 0,
        totalLost: 0
      };
    }
  }

  /**
   * Update wallet balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to add/subtract
   * @returns {Promise<boolean>} Success status
   */
  async updateWallet(userId, amount) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof amount !== 'number') {
      throw new ValidationError('Amount must be a number', 'amount', amount);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const gambling = userData.Gambling || {};
      
      gambling.wallet = Math.max(0, (gambling.wallet || 0) + amount);
      userData.Gambling = gambling;
      
      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update wallet for user ${userId}`, error);
    }
  }

  /**
   * Transfer money between wallet and bank
   * @param {string} userId - User ID
   * @param {number} amount - Amount to transfer
   * @param {boolean} toBank - True to deposit to bank, false to withdraw to wallet
   * @returns {Promise<boolean>} Success status
   */
  async transferMoney(userId, amount, toBank = true) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new ValidationError('Amount must be a positive number', 'amount', amount);
    }

    if (typeof toBank !== 'boolean') {
      throw new ValidationError('toBank must be a boolean', 'toBank', toBank);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const gambling = userData.Gambling || {};

      if (toBank) {
        // Deposit: wallet -> bank
        if ((gambling.wallet || 0) < amount) {
          return false; // Insufficient funds
        }
        gambling.wallet = (gambling.wallet || 0) - amount;
        gambling.bank = (gambling.bank || 0) + amount;
      } else {
        // Withdraw: bank -> wallet
        if ((gambling.bank || 0) < amount) {
          return false; // Insufficient funds
        }
        gambling.bank = (gambling.bank || 0) - amount;
        gambling.wallet = (gambling.wallet || 0) + amount;
      }

      userData.Gambling = gambling;
      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to transfer money for user ${userId}`, error);
    }
  }

  /**
   * Update daily claim with UTC timestamp
   * @param {string} userId - User ID
   * @param {number} streak - New streak count
   * @returns {Promise<boolean>} Success status
   */
  async updateDailyClaim(userId, streak) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof streak !== 'number' || streak < 0) {
      throw new ValidationError('Streak must be a non-negative number', 'streak', streak);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const gambling = userData.Gambling || {};
      
      gambling.dailyClaim = {
        lastClaimed: new Date(), // UTC timestamp
        streak: streak
      };
      
      userData.Gambling = gambling;
      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update daily claim for user ${userId}`, error);
    }
  }

  /**
   * Update work timestamp with UTC
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async updateWorkTimestamp(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const gambling = userData.Gambling || {};
      
      gambling.lastWorked = new Date(); // UTC timestamp
      userData.Gambling = gambling;
      
      await this.set(userId, userData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to update work timestamp for user ${userId}`, error);
    }
  }

  /**
   * Update gambling statistics
   * @param {string} userId - User ID
   * @param {number} gambledAmount - Amount gambled
   * @param {number} wonAmount - Amount won
   * @param {number} lostAmount - Amount lost
   * @returns {Promise<boolean>} Success status
   */
  async updateGamblingStats(userId, gambledAmount, wonAmount, lostAmount) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof gambledAmount !== 'number' || gambledAmount < 0) {
      throw new ValidationError('Gambled amount must be a non-negative number', 'gambledAmount', gambledAmount);
    }

    if (typeof wonAmount !== 'number' || wonAmount < 0) {
      throw new ValidationError('Won amount must be a non-negative number', 'wonAmount', wonAmount);
    }

    if (typeof lostAmount !== 'number' || lostAmount < 0) {
      throw new ValidationError('Lost amount must be a non-negative number', 'lostAmount', lostAmount);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const gambling = userData.Gambling || {};
      
      gambling.totalGambled = (gambling.totalGambled || 0) + gambledAmount;
      gambling.totalWon = (gambling.totalWon || 0) + wonAmount;
      gambling.totalLost = (gambling.totalLost || 0) + lostAmount;
      
      userData.Gambling = gambling;
      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update gambling stats for user ${userId}`, error);
    }
  }

  // ===== USER PREFERENCES =====

  /**
   * Get user self prefix
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} Self prefix or null
   */
  async getSelfPrefix(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      return userData.SelfPrefix || null;
    } catch (error) {
      console.error(`Error getting self prefix for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Set user self prefix
   * @param {string} userId - User ID
   * @param {string|null} prefix - Self prefix or null to clear
   * @returns {Promise<boolean>} Success status
   */
  async setSelfPrefix(userId, prefix) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    // Validate prefix if not null
    if (prefix !== null) {
      if (typeof prefix !== 'string') {
        throw new ValidationError('Prefix must be a string or null', 'prefix', prefix);
      }

      if (prefix.length > 10) {
        throw new ValidationError('Prefix cannot be longer than 10 characters', 'prefix', prefix);
      }

      if (prefix.includes(' ')) {
        throw new ValidationError('Prefix cannot contain spaces', 'prefix', prefix);
      }
    }

    try {
      const userData = await this.ensureUserData(userId);
      userData.SelfPrefix = prefix;
      
      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set self prefix for user ${userId}`, error);
    }
  }

  /**
   * Get user timezone
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} Timezone or null
   */
  async getTimezone(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      return userData.Timezone || null;
    } catch (error) {
      console.error(`Error getting timezone for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Set user timezone
   * @param {string} userId - User ID
   * @param {string|null} timezone - Timezone or null to clear
   * @returns {Promise<boolean>} Success status
   */
  async setTimezone(userId, timezone) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (timezone !== null && typeof timezone !== 'string') {
      throw new ValidationError('Timezone must be a string or null', 'timezone', timezone);
    }

    try {
      const userData = await this.ensureUserData(userId);
      userData.Timezone = timezone;
      
      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set timezone for user ${userId}`, error);
    }
  }

  // ===== NOTES SYSTEM =====

  /**
   * Get user notes
   * @param {string} userId - User ID
   * @returns {Promise<Object[]>} Array of notes
   */
  async getNotes(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      return userData.Notes || [];
    } catch (error) {
      console.error(`Error getting notes for user ${userId}:`, error.message);
      return [];
    }
  }

  /**
   * Add note with UTC timestamp
   * @param {string} userId - User ID
   * @param {string} content - Note content
   * @returns {Promise<Object>} Created note
   */
  async addNote(userId, content) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new ValidationError('Note content is required', 'content', content);
    }

    if (content.length > 2000) {
      throw new ValidationError('Note content cannot exceed 2000 characters', 'content', content);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const notes = userData.Notes || [];
      
      const id = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
      const note = {
        id,
        content: content.trim(),
        createdAt: new Date() // UTC timestamp
      };
      
      notes.push(note);
      userData.Notes = notes;
      
      await this.set(userId, userData);
      return note;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add note for user ${userId}`, error);
    }
  }

  /**
   * Remove note
   * @param {string} userId - User ID
   * @param {number} noteId - Note ID
   * @returns {Promise<boolean>} Success status
   */
  async removeNote(userId, noteId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof noteId !== 'number' || noteId < 1) {
      throw new ValidationError('Valid note ID is required', 'noteId', noteId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const notes = userData.Notes || [];
      const initialLength = notes.length;
      
      userData.Notes = notes.filter(n => n.id !== noteId);
      
      if (userData.Notes.length < initialLength) {
        await this.set(userId, userData);
        return true;
      }
      
      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove note for user ${userId}`, error);
    }
  }

  /**
   * Clear all notes
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async clearNotes(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      userData.Notes = [];
      
      await this.set(userId, userData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to clear notes for user ${userId}`, error);
    }
  }

  // ===== REMINDERS SYSTEM =====

  /**
   * Get user reminders
   * @param {string} userId - User ID
   * @returns {Promise<Object[]>} Array of reminders
   */
  async getReminders(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      return userData.Reminders || [];
    } catch (error) {
      console.error(`Error getting reminders for user ${userId}:`, error.message);
      return [];
    }
  }

  /**
   * Add reminder with UTC timestamps
   * @param {string} userId - User ID
   * @param {string} content - Reminder content
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} isDaily - Whether reminder is daily
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @param {string} messageUrl - Message URL
   * @returns {Promise<Object>} Created reminder
   */
  async addReminder(userId, content, duration, isDaily, guildId, channelId, messageUrl) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new ValidationError('Reminder content is required', 'content', content);
    }

    if (typeof duration !== 'number' || duration <= 0) {
      throw new ValidationError('Duration must be a positive number', 'duration', duration);
    }

    if (typeof isDaily !== 'boolean') {
      throw new ValidationError('isDaily must be a boolean', 'isDaily', isDaily);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const reminders = userData.Reminders || [];
      
      const id = reminders.length > 0 ? Math.max(...reminders.map(r => r.id)) + 1 : 1;
      const nextTrigger = new Date(Date.now() + duration); // UTC timestamp
      
      const reminder = {
        id,
        content: content.trim(),
        duration,
        isDaily,
        nextTrigger,
        guildId,
        channelId,
        messageUrl,
        createdAt: new Date() // UTC timestamp
      };
      
      reminders.push(reminder);
      userData.Reminders = reminders;
      
      await this.set(userId, userData);
      return reminder;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add reminder for user ${userId}`, error);
    }
  }

  /**
   * Update reminder next trigger with UTC timestamp
   * @param {string} userId - User ID
   * @param {number} reminderId - Reminder ID
   * @param {Date} nextTrigger - Next trigger time
   * @returns {Promise<boolean>} Success status
   */
  async updateReminderNextTrigger(userId, reminderId, nextTrigger) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof reminderId !== 'number' || reminderId < 1) {
      throw new ValidationError('Valid reminder ID is required', 'reminderId', reminderId);
    }

    if (!(nextTrigger instanceof Date)) {
      throw new ValidationError('Next trigger must be a Date object', 'nextTrigger', nextTrigger);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const reminders = userData.Reminders || [];
      
      const reminder = reminders.find(r => r.id === reminderId);
      if (reminder) {
        reminder.nextTrigger = nextTrigger; // UTC timestamp
        userData.Reminders = reminders;
        await this.set(userId, userData);
        return true;
      }
      
      return false;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update reminder for user ${userId}`, error);
    }
  }

  // ===== BATCH OPERATIONS =====

  /**
   * Batch get gambling data for multiple users
   * @param {string[]} userIds - Array of user IDs
   * @returns {Promise<Map<string, Object>>} Map of user ID to gambling data
   */
  async batchGetGamblingData(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return new Map();
    }

    try {
      // Use the cache-first batch operation from BaseService
      const userDataMap = await this.batchGet(userIds);
      const gamblingMap = new Map();

      for (const userId of userIds) {
        const userData = userDataMap.get(userId);
        const gamblingData = userData?.Gambling || {
          wallet: 1000,
          bank: 0,
          dailyClaim: { lastClaimed: null, streak: 0 },
          robCooldown: null,
          lastWorked: null,
          begCooldown: null,
          lastInterestClaim: null,
          totalGambled: 0,
          totalWon: 0,
          totalLost: 0
        };
        gamblingMap.set(userId, gamblingData);
      }

      return gamblingMap;
    } catch (error) {
      console.error('Error batch getting gambling data:', error.message);
      
      // Return default gambling data for all users on error
      const defaultMap = new Map();
      for (const userId of userIds) {
        defaultMap.set(userId, {
          wallet: 1000,
          bank: 0,
          dailyClaim: { lastClaimed: null, streak: 0 },
          robCooldown: null,
          lastWorked: null,
          begCooldown: null,
          lastInterestClaim: null,
          totalGambled: 0,
          totalWon: 0,
          totalLost: 0
        });
      }
      return defaultMap;
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Check if user exists in database
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if user exists
   */
  async userExists(userId) {
    if (!userId) {
      return false;
    }

    try {
      const userData = await this.get(userId);
      return userData !== null;
    } catch (error) {
      console.error(`Error checking if user ${userId} exists:`, error.message);
      return false;
    }
  }

  /**
   * Get user field value
   * @param {string} userId - User ID
   * @param {string} field - Field name
   * @returns {Promise<*>} Field value
   */
  async getUserField(userId, field) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!field) {
      throw new ValidationError('Field name is required', 'field', field);
    }

    try {
      const userData = await this.ensureUserData(userId);
      
      // Handle nested paths (e.g., "Gambling.begCooldown")
      const fieldParts = field.split('.');
      if (fieldParts.length > 1) {
        let current = userData;
        for (const part of fieldParts) {
          if (current === null || current === undefined) {
            return null;
          }
          current = current[part];
        }
        return current;
      }
      
      return userData[field];
    } catch (error) {
      console.error(`Error getting field ${field} for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Set user field value
   * @param {string} userId - User ID
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @returns {Promise<boolean>} Success status
   */
  async setUserField(userId, field, value) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!field) {
      throw new ValidationError('Field name is required', 'field', field);
    }

    try {
      const userData = await this.ensureUserData(userId);
      
      // Handle nested paths (e.g., "Gambling.begCooldown")
      const fieldParts = field.split('.');
      if (fieldParts.length > 1) {
        let current = userData;
        for (let i = 0; i < fieldParts.length - 1; i++) {
          if (!current[fieldParts[i]]) {
            current[fieldParts[i]] = {};
          }
          current = current[fieldParts[i]];
        }
        current[fieldParts[fieldParts.length - 1]] = value;
      } else {
        userData[field] = value;
      }
      
      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set field ${field} for user ${userId}`, error);
    }
  }

  /**
   * Get user statistics
   * @returns {Object} User service statistics
   */
  getUserStats() {
    return {
      ...this.getCacheStats(),
      serviceName: 'UserService',
      modelName: this.modelName,
      database: this.database
    };
  }

  // ===== BATCH OPERATIONS =====

  /**
   * Get gambling data for multiple users (batch operation with cache-first strategy)
   * @param {string[]} userIds - Array of user IDs
   * @returns {Promise<Map<string, Object>>} Map of userId -> gambling data
   */
  async batchGetGamblingData(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new ValidationError('User IDs array is required', 'userIds', userIds);
    }

    const results = new Map();
    const missingIds = [];

    // Check cache first
    for (const userId of userIds) {
      const cached = this.cache.get(userId);
      if (cached && cached.Gambling) {
        results.set(userId, cached.Gambling);
      } else {
        missingIds.push(userId);
      }
    }

    // If all found in cache, return
    if (missingIds.length === 0) {
      return results;
    }

    // Batch fetch from database
    try {
      const Model = this.getModel();
      const users = await Model.find({
        [this.keyField]: { $in: missingIds }
      }).lean();

      // Cache and add to results
      for (const user of users) {
        const userId = user[this.keyField];
        this.cache.set(userId, user);
        results.set(userId, user.Gambling || this.getDefaultGamblingData());
      }

      // Add default for users not found
      for (const userId of missingIds) {
        if (!results.has(userId)) {
          results.set(userId, this.getDefaultGamblingData());
        }
      }

      return results;
    } catch (error) {
      console.error('Error in batch get gambling data:', error.message);
      return results;
    }
  }

  /**
   * Get user data for multiple users (batch operation)
   * @param {string[]} userIds - Array of user IDs
   * @returns {Promise<Map<string, Object>>} Map of userId -> user data
   */
  async batchGetUsers(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new ValidationError('User IDs array is required', 'userIds', userIds);
    }

    const results = new Map();
    const missingIds = [];

    // Check cache first
    for (const userId of userIds) {
      const cached = this.cache.get(userId);
      if (cached) {
        results.set(userId, cached);
      } else {
        missingIds.push(userId);
      }
    }

    // If all found in cache, return
    if (missingIds.length === 0) {
      return results;
    }

    // Batch fetch from database
    try {
      const Model = this.getModel();
      const users = await Model.find({
        [this.keyField]: { $in: missingIds }
      }).lean();

      // Cache and add to results
      for (const user of users) {
        const userId = user[this.keyField];
        this.cache.set(userId, user);
        results.set(userId, user);
      }

      return results;
    } catch (error) {
      console.error('Error in batch get users:', error.message);
      return results;
    }
  }

  /**
   * Get specific field for multiple users (batch operation)
   * @param {string[]} userIds - Array of user IDs
   * @param {string} field - Field name to retrieve
   * @returns {Promise<Map<string, any>>} Map of userId -> field value
   */
  async batchGetField(userIds, field) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new ValidationError('User IDs array is required', 'userIds', userIds);
    }

    if (!field) {
      throw new ValidationError('Field name is required', 'field', field);
    }

    const users = await this.batchGetUsers(userIds);
    const results = new Map();

    for (const [userId, userData] of users) {
      results.set(userId, userData?.[field]);
    }

    return results;
  }

  /**
   * Get leaderboard data (optimized batch operation)
   * @param {string[]} userIds - Array of user IDs
   * @param {string} sortField - Field to sort by (e.g., 'Gambling.wallet')
   * @param {number} limit - Number of results to return
   * @returns {Promise<Array>} Sorted array of user data
   */
  async getLeaderboard(userIds, sortField = 'Gambling.wallet', limit = 10) {
    const users = await this.batchGetUsers(userIds);
    const userArray = Array.from(users.values());

    // Sort by field
    const sorted = userArray.sort((a, b) => {
      const aValue = this.getNestedField(a, sortField) || 0;
      const bValue = this.getNestedField(b, sortField) || 0;
      return bValue - aValue;
    });

    return sorted.slice(0, limit);
  }

  /**
   * Helper to get nested field value
   * @private
   */
  getNestedField(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // ===== BIRTHDAY OPERATIONS =====

  /**
   * Get user birthday
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Birthday object with day and month, or null
   */
  async getBirthday(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const birthday = userData.Birthday || {};
      
      if (birthday.day && birthday.month) {
        return {
          day: birthday.day,
          month: birthday.month,
          setAt: birthday.setAt
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting birthday for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Set user birthday with UTC timestamp
   * @param {string} userId - User ID
   * @param {number} day - Day of month (1-31)
   * @param {number} month - Month (1-12)
   * @returns {Promise<boolean>} Success status
   */
  async setBirthday(userId, day, month) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof day !== 'number' || day < 1 || day > 31) {
      throw new ValidationError('Day must be a number between 1 and 31', 'day', day);
    }

    if (typeof month !== 'number' || month < 1 || month > 12) {
      throw new ValidationError('Month must be a number between 1 and 12', 'month', month);
    }

    try {
      const userData = await this.ensureUserData(userId);
      
      userData.Birthday = {
        day,
        month,
        setAt: new Date() // UTC timestamp
      };
      
      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set birthday for user ${userId}`, error);
    }
  }

  /**
   * Clear user birthday
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async clearBirthday(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      
      userData.Birthday = {
        day: null,
        month: null,
        setAt: null
      };
      
      await this.set(userId, userData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to clear birthday for user ${userId}`, error);
    }
  }

  /**
   * Get formatted birthday string
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} Formatted birthday (e.g., "March 15") or null
   */
  async getFormattedBirthday(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const birthday = await this.getBirthday(userId);
      
      if (!birthday) {
        return null;
      }

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      const monthName = monthNames[birthday.month - 1];
      return `${monthName} ${birthday.day}`;
    } catch (error) {
      console.error(`Error getting formatted birthday for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Check if today is user's birthday
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if today is user's birthday
   */
  async isBirthday(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const birthday = await this.getBirthday(userId);
      
      if (!birthday) {
        return false;
      }

      const now = new Date();
      const currentDay = now.getDate();
      const currentMonth = now.getMonth() + 1;

      return birthday.day === currentDay && birthday.month === currentMonth;
    } catch (error) {
      console.error(`Error checking if birthday for user ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Get all users with birthdays on a specific date
   * @param {number} day - Day of month (1-31)
   * @param {number} month - Month (1-12)
   * @returns {Promise<string[]>} Array of user IDs
   */
  async getUsersWithBirthday(day, month) {
    if (typeof day !== 'number' || day < 1 || day > 31) {
      throw new ValidationError('Day must be a number between 1 and 31', 'day', day);
    }

    if (typeof month !== 'number' || month < 1 || month > 12) {
      throw new ValidationError('Month must be a number between 1 and 12', 'month', month);
    }

    try {
      const Model = this.getModel();
      const users = await Model.find({
        'Birthday.day': day,
        'Birthday.month': month
      }).lean();

      return users.map(user => user[this.keyField]);
    } catch (error) {
      console.error(`Error getting users with birthday ${month}/${day}:`, error.message);
      return [];
    }
  }
}

module.exports = UserService;
