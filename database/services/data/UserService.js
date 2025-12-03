const BaseService = require('../core/BaseService');
const { ValidationError, NotFoundError, DatabaseWriteError } = require('../core/errors');

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
            bankLimit: 50000, // Default bank limit
            dailyClaim: {
              lastClaimed: null,
              streak: 0
            },
            robCooldown: null,
            lastWorked: null,
            begCooldown: null,
            lastVote: null,
            totalVotes: 0,
            totalGambled: 0,
            totalWon: 0,
            totalLost: 0,
            luck: 0,
            lastCursed: null,
            lastPrayed: null
          },
          Inventory: {
            items: []
          },
          LastFMUsername: null,
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
   * Get default gambling data structure
   * @private
   * @returns {Object} Default gambling data
   */
  getDefaultGamblingData() {
    return {
      wallet: 1000,
      bank: 0,
      bankLimit: 50000, // Default bank limit
      dailyClaim: { lastClaimed: null, streak: 0 },
      robCooldown: null,
      lastWorked: null,
      begCooldown: null,
      lastVote: null,
      totalVotes: 0,
      totalGambled: 0,
      totalWon: 0,
      totalLost: 0,
      luck: 0,
      lastCursed: null,
      lastPrayed: null
    };
  }

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
      let gamblingData = userData.Gambling || this.getDefaultGamblingData();
      

      
      // Fix undefined bankLimit in existing gambling data - ONLY for truly missing values
      if (gamblingData && (gamblingData.bankLimit === undefined || gamblingData.bankLimit === null)) {
        console.log(`🚨 SELF-HEALING TRIGGERED for ${userId}: ${gamblingData.bankLimit} -> 50000`);
        console.log(`   - Stack trace:`, new Error().stack);
        gamblingData.bankLimit = 50000;
        // Update the database to fix this permanently
        userData.Gambling = gamblingData;
        await this.set(userId, userData);
      }
      

      
      return gamblingData;
    } catch (error) {
      console.error(`Error getting gambling data for user ${userId}:`, error.message);
      const defaultData = this.getDefaultGamblingData();
      

      
      return defaultData;
    }
  }

  /**
   * Update wallet balance (atomic operation to prevent race conditions)
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
      const gambling = userData.Gambling || this.getDefaultGamblingData();
      
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
      const gambling = userData.Gambling || this.getDefaultGamblingData();

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
      const gambling = userData.Gambling || this.getDefaultGamblingData();
      
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
      const gambling = userData.Gambling || this.getDefaultGamblingData();
      
      gambling.lastWorked = new Date(); // UTC timestamp
      userData.Gambling = gambling;
      
      await this.set(userId, userData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to update work timestamp for user ${userId}`, error);
    }
  }

  /**
   * Update vote timestamp and count with UTC
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async updateVoteTimestamp(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const gambling = userData.Gambling || this.getDefaultGamblingData();
      
      gambling.lastVote = new Date(); // UTC timestamp
      gambling.totalVotes = (gambling.totalVotes || 0) + 1;
      userData.Gambling = gambling;
      
      await this.set(userId, userData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to update vote timestamp for user ${userId}`, error);
    }
  }

  /**
   * Get user luck points
   * @param {string} userId - User ID
   * @returns {Promise<number>} Current luck points
   */
  async getLuck(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const gambling = userData.Gambling || this.getDefaultGamblingData();
      return gambling.luck || 0;
    } catch (error) {
      console.error(`Error getting luck for user ${userId}:`, error.message);
      return 0;
    }
  }

  /**
   * Update user luck points
   * @param {string} userId - User ID
   * @param {number} amount - Amount to add/subtract from luck
   * @returns {Promise<number>} New luck value
   */
  async updateLuck(userId, amount) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof amount !== 'number') {
      throw new ValidationError('Amount must be a number', 'amount', amount);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const gambling = userData.Gambling || this.getDefaultGamblingData();
      
      // Update luck with bounds (-100 to 100)
      const currentLuck = gambling.luck || 0;
      const newLuck = Math.max(-100, Math.min(100, currentLuck + amount));
      
      gambling.luck = newLuck;
      userData.Gambling = gambling;
      
      await this.set(userId, userData);
      return newLuck;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update luck for user ${userId}`, error);
    }
  }

  /**
   * Set user luck points directly
   * @param {string} userId - User ID
   * @param {number} luck - Luck value to set
   * @returns {Promise<number>} New luck value
   */
  async setLuck(userId, luck) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof luck !== 'number') {
      throw new ValidationError('Luck must be a number', 'luck', luck);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const gambling = userData.Gambling || this.getDefaultGamblingData();
      
      // Set luck with bounds (-100 to 100)
      const newLuck = Math.max(-100, Math.min(100, luck));
      
      gambling.luck = newLuck;
      userData.Gambling = gambling;
      
      await this.set(userId, userData);
      return newLuck;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set luck for user ${userId}`, error);
    }
  }

  /**
   * Update curse timestamp with UTC
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async updateCurseTimestamp(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const gambling = userData.Gambling || this.getDefaultGamblingData();
      
      gambling.lastCursed = new Date(); // UTC timestamp
      userData.Gambling = gambling;
      
      await this.set(userId, userData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to update curse timestamp for user ${userId}`, error);
    }
  }

  /**
   * Update pray timestamp with UTC
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async updatePrayTimestamp(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const gambling = userData.Gambling || this.getDefaultGamblingData();
      
      gambling.lastPrayed = new Date(); // UTC timestamp
      userData.Gambling = gambling;
      
      await this.set(userId, userData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to update pray timestamp for user ${userId}`, error);
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
      const gambling = userData.Gambling || this.getDefaultGamblingData();
      
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
        const gamblingData = userData?.Gambling || this.getDefaultGamblingData();
        gamblingMap.set(userId, gamblingData);
      }

      return gamblingMap;
    } catch (error) {
      console.error('Error batch getting gambling data:', error.message);
      
      // Return default gambling data for all users on error
      const defaultMap = new Map();
      for (const userId of userIds) {
        defaultMap.set(userId, this.getDefaultGamblingData());
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

  /**
   * Get all users with gambling data globally
   * @returns {Promise<Array>} Array of users with gambling data
   */
  async getAllUsersWithGamblingData() {
    try {
      const Model = this.getModel();
      const users = await Model.find({
        $or: [
          { 'Gambling.wallet': { $gt: 0 } },
          { 'Gambling.bank': { $gt: 0 } }
        ]
      }).lean();

      return users;
    } catch (error) {
      console.error('Error getting all users with gambling data:', error.message);
      return [];
    }
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

  // ===== ROLEPLAY OPERATIONS =====

  /**
   * Track roleplay interaction and return count
   * @param {string} userId - User performing the action
   * @param {string} targetId - User receiving the action
   * @param {string} action - Action type (hug, kiss, pat, etc.)
   * @returns {Promise<number>} Total count of this interaction
   */
  async trackRoleplayInteraction(userId, targetId, action) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!targetId) {
      throw new ValidationError('Target ID is required', 'targetId', targetId);
    }

    if (!action) {
      throw new ValidationError('Action is required', 'action', action);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const roleplay = userData.Roleplay || { given: [], received: [] };

      if (!roleplay.given) {
        roleplay.given = [];
      }

      // Find existing interaction
      let interaction = roleplay.given.find(
        r => r.targetId === targetId && r.action === action
      );

      if (interaction) {
        interaction.count++;
        interaction.lastInteraction = new Date();
      } else {
        interaction = {
          targetId,
          action,
          count: 1,
          lastInteraction: new Date()
        };
        roleplay.given.push(interaction);
      }

      userData.Roleplay = roleplay;
      await this.set(userId, userData);

      // Also track in target's received
      if (targetId !== userId) {
        await this.trackRoleplayReceived(targetId, userId, action);
      }

      return interaction.count;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to track roleplay interaction for user ${userId}`, error);
    }
  }

  /**
   * Track received roleplay interaction (internal helper)
   * @private
   * @param {string} userId - User receiving the action
   * @param {string} fromId - User performing the action
   * @param {string} action - Action type
   * @returns {Promise<void>}
   */
  async trackRoleplayReceived(userId, fromId, action) {
    try {
      const userData = await this.ensureUserData(userId);
      const roleplay = userData.Roleplay || { given: [], received: [] };

      if (!roleplay.received) {
        roleplay.received = [];
      }

      // Find existing interaction
      let interaction = roleplay.received.find(
        r => r.fromId === fromId && r.action === action
      );

      if (interaction) {
        interaction.count++;
        interaction.lastInteraction = new Date();
      } else {
        interaction = {
          fromId,
          action,
          count: 1,
          lastInteraction: new Date()
        };
        roleplay.received.push(interaction);
      }

      userData.Roleplay = roleplay;
      await this.set(userId, userData);
    } catch (error) {
      // Silent fail for received tracking
      console.error(`Error tracking received roleplay for user ${userId}:`, error.message);
    }
  }

  /**
   * Get roleplay count between two users
   * @param {string} userId - User performing the action
   * @param {string} targetId - User receiving the action
   * @param {string} action - Action type
   * @returns {Promise<number>} Count of interactions
   */
  async getRoleplayCount(userId, targetId, action) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!targetId) {
      throw new ValidationError('Target ID is required', 'targetId', targetId);
    }

    if (!action) {
      throw new ValidationError('Action is required', 'action', action);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const roleplay = userData.Roleplay || { given: [], received: [] };

      if (!roleplay.given) {
        return 0;
      }

      const interaction = roleplay.given.find(
        r => r.targetId === targetId && r.action === action
      );

      return interaction ? interaction.count : 0;
    } catch (error) {
      console.error(`Error getting roleplay count for user ${userId}:`, error.message);
      return 0;
    }
  }

  /**
   * Get all roleplay interactions given by user
   * @param {string} userId - User ID
   * @param {string} action - Optional action filter
   * @returns {Promise<Array>} Array of roleplay interactions
   */
  async getRoleplayGiven(userId, action = null) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const roleplay = userData.Roleplay || { given: [], received: [] };

      let interactions = roleplay.given || [];

      if (action) {
        interactions = interactions.filter(r => r.action === action);
      }

      return interactions;
    } catch (error) {
      console.error(`Error getting roleplay given for user ${userId}:`, error.message);
      return [];
    }
  }

  /**
   * Get all roleplay interactions received by user
   * @param {string} userId - User ID
   * @param {string} action - Optional action filter
   * @returns {Promise<Array>} Array of roleplay interactions
   */
  async getRoleplayReceived(userId, action = null) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const roleplay = userData.Roleplay || { given: [], received: [] };

      let interactions = roleplay.received || [];

      if (action) {
        interactions = interactions.filter(r => r.action === action);
      }

      return interactions;
    } catch (error) {
      console.error(`Error getting roleplay received for user ${userId}:`, error.message);
      return [];
    }
  }

  /**
   * Get roleplay leaderboard for a specific action
   * @param {string} action - Action type
   * @param {number} limit - Number of results to return
   * @returns {Promise<Array>} Array of top users
   */
  async getRoleplayLeaderboard(action, limit = 10) {
    if (!action) {
      throw new ValidationError('Action is required', 'action', action);
    }

    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100', 'limit', limit);
    }

    try {
      const Model = this.getModel();
      const users = await Model.find({
        'Roleplay.given': {
          $elemMatch: { action: action }
        }
      }).lean();

      // Calculate total counts for each user
      const leaderboard = users.map(user => {
        const given = user.Roleplay?.given || [];
        const totalCount = given
          .filter(r => r.action === action)
          .reduce((sum, r) => sum + r.count, 0);

        return {
          userId: user[this.keyField],
          action,
          count: totalCount
        };
      });

      // Sort by count descending
      leaderboard.sort((a, b) => b.count - a.count);

      return leaderboard.slice(0, limit);
    } catch (error) {
      console.error(`Error getting roleplay leaderboard for ${action}:`, error.message);
      return [];
    }
  }

  // ===== LAST.FM OPERATIONS =====

  /**
   * Get Last.fm username
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} Last.fm username or null
   */
  async getLastFMUsername(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      return userData.LastFMUsername || null;
    } catch (error) {
      console.error(`Error getting Last.fm username for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Set Last.fm username
   * @param {string} userId - User ID
   * @param {string|null} username - Last.fm username or null to clear
   * @returns {Promise<boolean>} Success status
   */
  async setLastFMUsername(userId, username) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (username !== null && typeof username !== 'string') {
      throw new ValidationError('Username must be a string or null', 'username', username);
    }

    try {
      const userData = await this.ensureUserData(userId);
      userData.LastFMUsername = username;

      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set Last.fm username for user ${userId}`, error);
    }
  }

  /**
   * Get Last.fm settings
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Last.fm settings
   */
  async getLastFMSettings(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      return userData.LastFMSettings || {};
    } catch (error) {
      console.error(`Error getting Last.fm settings for user ${userId}:`, error.message);
      return {};
    }
  }

  /**
   * Set Last.fm settings
   * @param {string} userId - User ID
   * @param {Object} settings - Last.fm settings
   * @returns {Promise<boolean>} Success status
   */
  async setLastFMSettings(userId, settings) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!settings || typeof settings !== 'object') {
      throw new ValidationError('Settings must be an object', 'settings', settings);
    }

    try {
      const userData = await this.ensureUserData(userId);
      userData.LastFMSettings = settings;

      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set Last.fm settings for user ${userId}`, error);
    }
  }

  // ===== TIC TAC TOE OPERATIONS =====

  /**
   * Get TicTacToe stats
   * @param {string} userId - User ID
   * @returns {Promise<Object>} TicTacToe stats
   */
  async getTicTacToeStats(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      return userData.TicTacToe || {
        wins: 0,
        losses: 0,
        draws: 0
      };
    } catch (error) {
      console.error(`Error getting TicTacToe stats for user ${userId}:`, error.message);
      return {
        wins: 0,
        losses: 0,
        draws: 0
      };
    }
  }

  /**
   * Update TicTacToe stats
   * @param {string} userId - User ID
   * @param {string} result - Result type ('win', 'loss', or 'draw')
   * @returns {Promise<boolean>} Success status
   */
  async updateTicTacToeStats(userId, result) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!['win', 'loss', 'draw'].includes(result)) {
      throw new ValidationError('Result must be win, loss, or draw', 'result', result);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const stats = userData.TicTacToe || {
        wins: 0,
        losses: 0,
        draws: 0
      };

      if (result === 'win') {
        stats.wins++;
      } else if (result === 'loss') {
        stats.losses++;
      } else if (result === 'draw') {
        stats.draws++;
      }

      userData.TicTacToe = stats;

      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to update TicTacToe stats for user ${userId}`, error);
    }
  }

  /**
   * Reset TicTacToe stats
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async resetTicTacToeStats(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      userData.TicTacToe = {
        wins: 0,
        losses: 0,
        draws: 0
      };

      await this.set(userId, userData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to reset TicTacToe stats for user ${userId}`, error);
    }
  }

  // ===== REMINDER SYSTEM EXTENDED =====

  /**
   * Remove a specific reminder
   * @param {string} userId - User ID
   * @param {number} reminderId - Reminder ID
   * @returns {Promise<Object|null>} Removed reminder or null
   */
  async removeReminder(userId, reminderId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof reminderId !== 'number' || reminderId < 1) {
      throw new ValidationError('Valid reminder ID is required', 'reminderId', reminderId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const reminders = userData.Reminders || [];
      
      // Find the reminder to remove
      const reminderToRemove = reminders.find(r => r.id === reminderId);
      
      if (reminderToRemove) {
        // Filter out the reminder
        userData.Reminders = reminders.filter(r => r.id !== reminderId);
        await this.set(userId, userData);
        return reminderToRemove;
      }
      
      return null; // Reminder not found
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove reminder for user ${userId}`, error);
    }
  }

  /**
   * Clear all reminders for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of reminders cleared
   */
  async clearReminders(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const reminders = userData.Reminders || [];
      const count = reminders.length;
      
      userData.Reminders = [];
      await this.set(userId, userData);
      
      return count;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to clear reminders for user ${userId}`, error);
    }
  }

  // ===== NAME HISTORY SYSTEM =====

  /**
   * Get user's name change history
   * @param {string} userId - User ID
   * @returns {Promise<Object[]>} Array of name history entries
   */
  async getNameHistory(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const history = userData.NameHistory || [];
      
      // Sort by changedAt descending (newest first)
      return history.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
    } catch (error) {
      console.error(`Error getting name history for user ${userId}:`, error.message);
      return [];
    }
  }

  /**
   * Add name change to history (new format with type)
   * @param {string} userId - User ID
   * @param {string} type - Type of name change ('username', 'displayname', 'nickname')
   * @param {string} oldName - Old name
   * @param {string} newName - New name
   * @param {string|null} guildId - Guild ID (null for global changes)
   * @returns {Promise<Object>} Created history entry
   */
  async addNameChange(userId, type, oldName, newName, guildId = null) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!type || !['username', 'displayname', 'nickname'].includes(type)) {
      throw new ValidationError('Type must be username, displayname, or nickname', 'type', type);
    }

    if (!oldName || typeof oldName !== 'string') {
      throw new ValidationError('Old name is required', 'oldName', oldName);
    }

    if (!newName || typeof newName !== 'string') {
      throw new ValidationError('New name is required', 'newName', newName);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const history = userData.NameHistory || [];
      
      const historyEntry = {
        type,
        oldName: oldName.trim(),
        newName: newName.trim(),
        guildId: guildId || null,
        changedAt: new Date()
      };
      
      // Check if this exact change already exists as the most recent entry
      if (history.length > 0) {
        const mostRecent = history[history.length - 1];
        if (mostRecent.type === type && 
            mostRecent.oldName === historyEntry.oldName && 
            mostRecent.newName === historyEntry.newName &&
            mostRecent.guildId === historyEntry.guildId) {
          // Don't add duplicate consecutive changes
          return mostRecent;
        }
      }
      
      history.push(historyEntry);
      userData.NameHistory = history;
      
      await this.set(userId, userData);
      return historyEntry;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add name change for user ${userId}`, error);
    }
  }

  /**
   * Add name change to history (legacy format)
   * @param {string} userId - User ID
   * @param {string} name - New name
   * @param {Date} changedAt - When the name changed (defaults to now)
   * @param {string} discriminator - Optional discriminator
   * @returns {Promise<Object>} Created history entry
   */
  async addNameHistory(userId, name, changedAt = null, discriminator = null) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Name is required', 'name', name);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const history = userData.NameHistory || [];
      
      const historyEntry = {
        name: name.trim(),
        changedAt: changedAt || new Date(),
        discriminator: discriminator || null
      };
      
      // Check if this exact name already exists as the most recent entry
      if (history.length > 0) {
        const mostRecent = history[history.length - 1];
        if (mostRecent.name === historyEntry.name) {
          // Don't add duplicate consecutive names
          return mostRecent;
        }
      }
      
      history.push(historyEntry);
      userData.NameHistory = history;
      
      await this.set(userId, userData);
      return historyEntry;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add name history for user ${userId}`, error);
    }
  }

  /**
   * Clear user's name history (alias for clearAllNameHistory)
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of entries cleared
   */
  async clearNameHistory(userId) {
    return this.clearAllNameHistory(userId);
  }

  /**
   * Clear all name history for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of entries cleared
   */
  async clearAllNameHistory(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const history = userData.NameHistory || [];
      const count = history.length;
      
      userData.NameHistory = [];
      await this.set(userId, userData);
      
      return count;
    } catch (error) {
      throw new DatabaseWriteError(`Failed to clear name history for user ${userId}`, error);
    }
  }

  // ===== AFK METHODS =====

  /**
   * Get AFK status for a user (global across all servers)
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} AFK status or null
   */
  async getAFKStatus(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      return userData.AFK || null;
    } catch (error) {
      console.error(`Error getting AFK status for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Set AFK status for a user (global across all servers)
   * @param {string} userId - User ID
   * @param {string} reason - AFK reason
   * @returns {Promise<boolean>} Success status
   */
  async setAFKStatus(userId, reason) {
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
      const userData = await this.ensureUserData(userId);
      
      userData.AFK = {
        message: reason.trim(),
        since: new Date()
      };

      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set AFK status for user ${userId}`, error);
    }
  }

  /**
   * Remove AFK status for a user (global across all servers)
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async removeAFKStatus(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      
      if (userData.AFK) {
        delete userData.AFK;
        await this.set(userId, userData);
        return true;
      }

      return false; // User was not AFK
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to remove AFK status for user ${userId}`, error);
    }
  }

  // ===== INVENTORY OPERATIONS =====

  /**
   * Get user's inventory
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User's inventory items
   */
  async getInventory(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      return userData.Inventory?.items || [];
    } catch (error) {
      console.error(`Error getting inventory for user ${userId}:`, error.message);
      return [];
    }
  }

  /**
   * Add item to user's inventory
   * @param {string} userId - User ID
   * @param {Object} item - Item to add
   * @returns {Promise<boolean>} Success status
   */
  async addInventoryItem(userId, item) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      if (!userData.Inventory) {
        userData.Inventory = { items: [] };
      }
      if (!userData.Inventory.items) {
        userData.Inventory.items = [];
      }

      // Check if item already exists (for stackable items)
      const existingItem = userData.Inventory.items.find(i => i.id === item.id);
      if (existingItem && item.stackable) {
        existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);
      } else {
        userData.Inventory.items.push({
          ...item,
          quantity: item.quantity || 1,
          acquiredAt: new Date().toISOString()
        });
      }

      await this.set(userId, userData);
      return true;
    } catch (error) {
      console.error(`Error adding item to inventory for user ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Remove item from user's inventory
   * @param {string} userId - User ID
   * @param {string} itemId - Item ID to remove
   * @param {number} quantity - Quantity to remove (default: 1)
   * @returns {Promise<boolean>} Success status
   */
  async removeInventoryItem(userId, itemId, quantity = 1) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      if (!userData.Inventory) {
        return false;
      }

      const itemIndex = userData.Inventory.items.findIndex(i => i.id === itemId);
      if (itemIndex === -1) {
        return false;
      }

      const item = userData.Inventory.items[itemIndex];
      if (item.quantity > quantity) {
        item.quantity -= quantity;
      } else {
        userData.Inventory.items.splice(itemIndex, 1);
      }

      await this.set(userId, userData);
      return true;
    } catch (error) {
      console.error(`Error removing item from inventory for user ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Get user's bank limit
   * @param {string} userId - User ID
   * @returns {Promise<number>} Bank limit
   */
  async getBankLimit(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      // Handle undefined, null, or missing bankLimit
      let bankLimit = userData.Gambling?.bankLimit;
      
      if (bankLimit === undefined || bankLimit === null || typeof bankLimit !== 'number') {
        console.log(`🚨 GETBANKLIMIT FALLBACK TRIGGERED for ${userId}: ${bankLimit} (${typeof bankLimit}) -> 50000`);
        console.log(`   - Stack trace:`, new Error().stack);
        bankLimit = 50000;
        // Fix the database permanently
        if (!userData.Gambling) {
          userData.Gambling = this.getDefaultGamblingData();
        } else {
          userData.Gambling.bankLimit = bankLimit;
        }
        await this.set(userId, userData);
      }
      
      return bankLimit;
    } catch (error) {
      console.error(`Error getting bank limit for user ${userId}:`, error.message);
      return 50000;
    }
  }

  /**
   * Update user's bank limit
   * @param {string} userId - User ID
   * @param {number} newLimit - New bank limit
   * @returns {Promise<boolean>} Success status
   */
  async updateBankLimit(userId, newLimit) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (typeof newLimit !== 'number' || newLimit < 0) {
      throw new ValidationError('New limit must be a positive number', 'newLimit', newLimit);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const oldLimit = userData.Gambling?.bankLimit;
      
      if (!userData.Gambling) {
        userData.Gambling = this.getDefaultGamblingData();
      }
      
      userData.Gambling.bankLimit = newLimit;
      
      await this.set(userId, userData);
      

      
      return true;
    } catch (error) {
      console.error(`Error updating bank limit for user ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Get all users from database
   * @returns {Promise<Map>} Map of all users
   */
  async getAllUsers() {
    try {
      return await this.getAll();
    } catch (error) {
      console.error('Error getting all users:', error.message);
      return new Map();
    }
  }

  // ===== JAIL SYSTEM ROLE MANAGEMENT =====

  /**
   * Save user roles when jailed
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {Array<string>} roles - Array of role IDs to save
   * @returns {Promise<boolean>} Success status
   */
  async saveJailedRoles(userId, guildId, roles) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    if (!Array.isArray(roles)) {
      throw new ValidationError('Roles must be an array', 'roles', roles);
    }

    try {
      const userData = await this.ensureUserData(userId);
      
      if (!userData.JailedRoles) {
        userData.JailedRoles = [];
      }

      // Remove any existing jail role data for this guild
      userData.JailedRoles = userData.JailedRoles.filter(jr => jr.guildId !== guildId);

      // Add new jail role data
      userData.JailedRoles.push({
        guildId: guildId,
        roles: roles,
        savedAt: new Date()
      });

      await this.set(userId, userData);
      
      return true;
    } catch (error) {
      console.error(`Error saving jailed roles for user ${userId} in guild ${guildId}:`, error.message);
      throw new DatabaseWriteError(`Failed to save jailed roles for user ${userId}`, error);
    }
  }

  /**
   * Get saved roles for a jailed user
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array<string>>} Array of role IDs
   */
  async getJailedRoles(userId, guildId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      
      if (!userData.JailedRoles || userData.JailedRoles.length === 0) {
        return [];
      }

      // Find jail role data for this guild
      const jailData = userData.JailedRoles.find(jr => jr.guildId === guildId);
      
      return jailData ? jailData.roles : [];
    } catch (error) {
      console.error(`Error getting jailed roles for user ${userId} in guild ${guildId}:`, error.message);
      return [];
    }
  }

  /**
   * Remove saved roles for a jailed user
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async removeJailedRoles(userId, guildId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!guildId) {
      throw new ValidationError('Guild ID is required', 'guildId', guildId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      
      if (!userData.JailedRoles) {
        return true;
      }

      // Remove jail role data for this guild
      userData.JailedRoles = userData.JailedRoles.filter(jr => jr.guildId !== guildId);

      await this.set(userId, userData);
      
      return true;
    } catch (error) {
      console.error(`Error removing jailed roles for user ${userId} in guild ${guildId}:`, error.message);
      throw new DatabaseWriteError(`Failed to remove jailed roles for user ${userId}`, error);
    }
  }

  /**
   * Add a swear word to user's global tracking
   * @param {string} userId - User ID
   * @param {string} swear - Swear word
   * @returns {Promise<boolean>} Success status
   */
  async addSwear(userId, swear) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!swear) {
      throw new ValidationError('Swear is required', 'swear', swear);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const swearTracker = userData.SwearTracker || {
        swears: [],
        totalSwears: 0,
        todaySwears: 0,
        lastSwearDate: new Date()
      };

      const word = swear.toLowerCase();
      const now = new Date();

      // Find existing swear word in user's swears array
      let swearEntry = swearTracker.swears.find(s => s.word === word);

      if (swearEntry) {
        // Increment existing swear count
        swearEntry.count++;
      } else {
        // Add new swear word
        swearTracker.swears.push({
          word,
          count: 1
        });
      }

      // Update totals
      swearTracker.totalSwears++;

      // Check if it's today and update todaySwears
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastSwearDate = new Date(swearTracker.lastSwearDate);
      lastSwearDate.setHours(0, 0, 0, 0);

      if (lastSwearDate.getTime() === today.getTime()) {
        // Same day, increment today's count
        swearTracker.todaySwears++;
      } else {
        // New day, reset today's count
        swearTracker.todaySwears = 1;
      }

      swearTracker.lastSwearDate = now;
      userData.SwearTracker = swearTracker;

      await this.set(userId, userData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add swear for user ${userId}`, error);
    }
  }

  /**
   * Get user swear data with aggregated counts
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User swear data with aggregated counts
   */
  async getUserSwearData(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const userData = await this.ensureUserData(userId);
      const swearTracker = userData.SwearTracker || {};

      if (!swearTracker.swears || swearTracker.swears.length === 0) {
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
      const lastSwearDate = new Date(swearTracker.lastSwearDate);
      lastSwearDate.setHours(0, 0, 0, 0);

      const todaySwears = lastSwearDate.getTime() === today.getTime()
        ? (swearTracker.todaySwears || 0)
        : 0;

      // Calculate total from swears array
      const calculatedTotal = swearTracker.swears.reduce((sum, s) => sum + (s.count || 0), 0);

      return {
        userId,
        swears: swearTracker.swears.map(s => ({
          word: s.word,
          count: s.count
        })),
        todaySwears,
        totalSwears: calculatedTotal
      };
    } catch (error) {
      console.error(`Error getting user swear data for user ${userId}:`, error.message);
      return {
        userId,
        swears: [],
        todaySwears: 0,
        totalSwears: 0
      };
    }
  }

  /**
   * Get swear leaderboard for specific users (e.g., guild members)
   * @param {Array<string>} userIds - Array of user IDs to include
   * @returns {Promise<Array>} Array of user swear data sorted by total
   */
  async getSwearLeaderboardForUsers(userIds) {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    try {
      const User = this.model;
      
      // Find users with swear data, filtered by user IDs
      const users = await User.find({
        UserID: { $in: userIds },
        'SwearTracker.swears.0': { $exists: true }
      })
      .select('UserID SwearTracker')
      .lean();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Map to leaderboard format and calculate totals
      const leaderboard = users.map(user => {
        const swearTracker = user.SwearTracker || {};
        
        // Calculate total from swears array
        const calculatedTotal = (swearTracker.swears || []).reduce((sum, s) => sum + (s.count || 0), 0);
        
        // Check if todaySwears needs to be reset
        const lastSwearDate = new Date(swearTracker.lastSwearDate);
        lastSwearDate.setHours(0, 0, 0, 0);
        const todaySwears = lastSwearDate.getTime() === today.getTime()
          ? (swearTracker.todaySwears || 0)
          : 0;

        return {
          userId: user.UserID,
          calculatedTotal,
          todaySwears,
          swears: (swearTracker.swears || []).map(s => ({
            word: s.word,
            count: s.count
          }))
        };
      })
      .filter(user => user.calculatedTotal > 0)
      .sort((a, b) => b.calculatedTotal - a.calculatedTotal);

      return leaderboard;
    } catch (error) {
      console.error('Error getting swear leaderboard for users:', error.message);
      return [];
    }
  }

  /**
   * Get user's position in global swear leaderboard
   * @param {string} userId - User ID
   * @returns {Promise<number|null>} User's position or null
   */
  async getUserSwearPosition(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const User = this.model;
      
      // Get user's total swears
      const userData = await User.findOne({ UserID: userId })
        .select('SwearTracker.totalSwears')
        .lean();

      if (!userData || !userData.SwearTracker || userData.SwearTracker.totalSwears === 0) {
        return null;
      }

      const userTotal = userData.SwearTracker.totalSwears;

      // Count how many users have more swears
      const higherCount = await User.countDocuments({
        'SwearTracker.totalSwears': { $gt: userTotal }
      });

      return higherCount + 1;
    } catch (error) {
      console.error(`Error getting user swear position for user ${userId}:`, error.message);
      return null;
    }
  }
}

module.exports = UserService;
