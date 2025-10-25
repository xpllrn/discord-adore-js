const connection = require('./connection');
const { getShutdownManager } = require('./utils/GracefulShutdown');

// Import model schemas
const userSchema = require('./models/user');
const guildSchema = require('./models/guild');
const systemSchema = require('./models/system');

// Model instances (will be created after connection)
let User = null;
let Guild = null;
let System = null;

// Database readiness state
let isDatabaseFullyReady = false;
let initializationPromise = null;

/**
 * Initialize database connections
 * @param {Object|string} connectionStrings - Connection strings object or single string for backward compatibility
 * @param {string} connectionStrings.global - Global user database connection string
 * @param {string} connectionStrings.local - Local guild database connection string
 * @returns {Promise<boolean>} Connection success status
 */
async function initializeDatabase(connectionStrings) {
  // Prevent multiple simultaneous initializations
  if (initializationPromise) {
    return await initializationPromise;
  }

  initializationPromise = _performInitialization(connectionStrings);
  return await initializationPromise;
}

async function _performInitialization(connectionStrings) {
  const success = await connection.connect(connectionStrings);

  if (success) {
    // Get connections
    const connections = connection.getConnections();

    // Create models on appropriate connections
    if (connections.global) {
      // User data goes to global database
      User = connections.global.model('User', userSchema.schema);
      System = connections.global.model('System', systemSchema.schema);
    }

    if (connections.local) {
      // Guild data goes to local database
      Guild = connections.local.model('Guild', guildSchema.schema);

      // If no global connection, put user data in local (backward compatibility)
      if (!connections.global) {
        User = connections.local.model('User', userSchema.schema);
        System = connections.local.model('System', systemSchema.schema);
      }
    }

    // Ensure we have the required models
    if (!User || !Guild || !System) {
      return false;
    }

    // Mark database as fully ready
    isDatabaseFullyReady = true;

    // Initialize graceful shutdown system
    try {
      const shutdownManager = getShutdownManager();
      shutdownManager.initialize();

      // Add database shutdown handlers
      shutdownManager.addShutdownHandler('database', async () => {
        console.log('🔄 Closing database connections...');
        await connection.disconnect(false);
      }, 10); // High priority



      // Add health checks
      shutdownManager.addHealthCheck('database', async () => {
        const health = await connection.healthCheck();
        return health.overall;
      }, 60000);



      // Add error recovery handlers
      shutdownManager.addErrorRecoveryHandler('database-reconnect', async (type, error) => {
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          console.log('🔧 Attempting database reconnection...');
          const connections = connection.getConnections();
          if (connections.global && connections.global.readyState !== 1) {
            await connections.global.close();
          }
          if (connections.local && connections.local.readyState !== 1) {
            await connections.local.close();
          }
          // Reconnection will be handled by mongoose automatically
        }
      });

    } catch (error) {
      console.warn('⚠️ Failed to initialize graceful shutdown:', error.message);
    }
  } else {
    isDatabaseFullyReady = false;
  }

  return success;
}

/**
 * Check if databases are ready
 * @returns {Object} Connection status for each database
 */
function isDatabaseReady() {
  return connection.isReady();
}

/**
 * Check if database is fully ready for operations (models initialized)
 * @returns {boolean} True if database is fully ready
 */
function isDatabaseFullyInitialized() {
  return isDatabaseFullyReady && User && Guild && System;
}

/**
 * Wait for database to be fully ready
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<boolean>} True if ready, false if timeout
 */
async function waitForDatabaseReady(timeout = 30000) {
  const startTime = Date.now();

  while (!isDatabaseFullyInitialized()) {
    if (Date.now() - startTime > timeout) {
      return false;
    }

    // Wait 100ms before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return true;
}

/**
 * Disconnect from databases
 * @returns {Promise<void>}
 */
async function disconnectDatabase() {
  return await connection.disconnect();
}

/**
 * Ensures guild data exists in the database with default values
 * @param {string} guildId - The Discord guild ID
 * @returns {Promise<Object>} The guild data document
 */
async function ensureGuildData(guildId) {
  try {
    // Check if Guild model exists
    if (!Guild) {
      // Don't log error during startup - just return null silently
      return null;
    }

    // Use findOneAndUpdate with upsert to avoid race conditions
    const data = await Guild.findOneAndUpdate(
      { GuildID: guildId },
      {
        $setOnInsert: {
          GuildID: guildId,
          Prefix: ','
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        maxTimeMS: 5000 // 5 second timeout
      }
    );

    return data;
  } catch (error) {
    // If there's still a duplicate key error, just find and return the existing record
    if (error.code === 11000) {
      try {
        return await Guild.findOne({ GuildID: guildId }).maxTimeMS(5000);
      } catch (findError) {
        // Silent fail for find error
        return null;
      }
    }

    // For timeout errors, return null instead of throwing
    if (error.name === 'MongooseError' && error.message.includes('timed out')) {
      return null;
    }

    throw error;
  }
}

/**
 * Ensures user data exists in the database with default values
 * @param {string} userId - The Discord user ID
 * @returns {Promise<Object>} The user data document
 */
async function ensureUserData(userId) {
  try {
    // Check if User model exists
    if (!User) {
      // Don't log error during startup - just return null silently
      return null;
    }

    // Use findOneAndUpdate with upsert to avoid race conditions
    const data = await User.findOneAndUpdate(
      { UserID: userId },
      {
        $setOnInsert: {
          UserID: userId
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        maxTimeMS: 5000 // 5 second timeout
      }
    );

    return data;
  } catch (error) {
    // If there's still a duplicate key error, just find and return the existing record
    if (error.code === 11000) {
      try {
        return await User.findOne({ UserID: userId }).maxTimeMS(5000);
      } catch (findError) {
        // Silent fail for find error
        return null;
      }
    }

    // For timeout errors, return null instead of throwing
    if (error.name === 'MongooseError' && error.message.includes('timed out')) {
      return null;
    }

    throw error;
  }
}

/**
 * Ensures system data exists in the database with default values
 * @returns {Promise<Object>} The system data document
 */
async function ensureSystemData() {
  try {
    // Use findOneAndUpdate with upsert to avoid race conditions
    const data = await System.findOneAndUpdate(
      { _id: 'system' },
      {
        $setOnInsert: {
          _id: 'system',
          Blacklist: {
            users: [],
            servers: []
          }
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    return data;
  } catch (error) {
    // If there's still a duplicate key error, just find and return the existing record
    if (error.code === 11000) {
      return await System.findOne({ _id: 'system' });
    }
    throw error;
  }
}

// ===== MODERATION FUNCTIONS =====

/**
 * Add a new moderation case to the database
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID being moderated
 * @param {string} moderatorId - Moderator ID
 * @param {string} action - Moderation action (warn, mute, kick, ban, etc.)
 * @param {string} reason - Reason for the action
 * @param {string} duration - Duration (optional, for timed actions)
 * @returns {Promise<Object>} The created moderation case
 */
async function addModerationCase(guildId, userId, moderatorId, action, reason, duration = null) {
  try {
    // Check if Guild model is available
    if (!Guild) {
      throw new Error('Database not ready');
    }

    // Ensure guild data exists
    await ensureGuildData(guildId);

    // Get the guild document
    const guild = await Guild.findOne({ GuildID: guildId });

    // Get the next case ID for this guild
    const nextCaseId = guild.Moderation.length > 0
      ? Math.max(...guild.Moderation.map(c => c.caseId)) + 1
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

    // Add the moderation case to the guild's Moderation array
    guild.Moderation.push(moderationCase);
    
    // Clean invalid data before saving to avoid validation errors
    if (guild.MessageStats && Array.isArray(guild.MessageStats)) {
      guild.MessageStats = guild.MessageStats.filter(stat => stat && stat.date);
    }
    if (guild.StarboardMessages && Array.isArray(guild.StarboardMessages)) {
      guild.StarboardMessages = guild.StarboardMessages.filter(msg => msg && msg.originalMessageId);
    }
    
    await guild.save();

    return moderationCase;
  } catch (error) {
    throw error;
  }
}

/**
 * Get moderation history for a user
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @param {string} action - Optional action filter
 * @returns {Promise<Array>} Array of moderation cases
 */
async function getModerationHistory(guildId, userId, action = null) {
  try {
    // Check if Guild model is available
    if (!Guild) {
      return [];
    }

    const guild = await Guild.findOne({ GuildID: guildId });
    if (!guild) return [];

    let moderationHistory = guild.Moderation.filter(mod => mod.userId === userId);

    if (action) {
      moderationHistory = moderationHistory.filter(mod => mod.action === action);
    }

    // Sort by timestamp descending (newest first)
    return moderationHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    throw error;
  }
}

/**
 * Get a specific moderation case by case ID
 * @param {string} guildId - Guild ID
 * @param {number} caseId - Case ID
 * @returns {Promise<Object|null>} The moderation case or null if not found
 */
async function getModerationCase(guildId, caseId) {
  try {
    // Check if Guild model is available
    if (!Guild) {
      return null;
    }

    const guild = await Guild.findOne({ GuildID: guildId });
    if (!guild) return null;

    return guild.Moderation.find(mod => mod.caseId === caseId) || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Get moderation history by action type
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @param {string} action - Action type
 * @returns {Promise<Array>} Array of moderation cases
 */
async function getModerationHistoryByAction(guildId, userId, action) {
  try {
    return await getModerationHistory(guildId, userId, action);
  } catch (error) {
    throw error;
  }
}

/**
 * Get moderation history by moderator
 * @param {string} guildId - Guild ID
 * @param {string} moderatorId - Moderator ID
 * @param {string} action - Optional action filter
 * @returns {Promise<Array>} Array of moderation cases
 */
async function getModerationHistoryByModerator(guildId, moderatorId, action = null) {
  try {
    // Check if Guild model is available
    if (!Guild) {
      return [];
    }

    const guild = await Guild.findOne({ GuildID: guildId });
    if (!guild) return [];

    let moderationHistory = guild.Moderation.filter(mod => mod.moderatorId === moderatorId);

    if (action) {
      moderationHistory = moderationHistory.filter(mod => mod.action === action);
    }

    // Sort by timestamp descending (newest first)
    return moderationHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    throw error;
  }
}

/**
 * Remove a specific moderation case
 * @param {string} guildId - Guild ID
 * @param {number} caseId - Case ID
 * @returns {Promise<Object>} Deletion result
 */
async function removeModerationCase(guildId, caseId) {
  try {
    // Check if Guild model is available
    if (!Guild) {
      return { deletedCount: 0 };
    }

    const guild = await Guild.findOne({ GuildID: guildId });
    if (!guild) return { deletedCount: 0 };

    const initialLength = guild.Moderation.length;
    guild.Moderation = guild.Moderation.filter(mod => mod.caseId !== caseId);

    if (guild.Moderation.length < initialLength) {
      // Clean invalid data before saving
      if (guild.MessageStats && Array.isArray(guild.MessageStats)) {
        guild.MessageStats = guild.MessageStats.filter(stat => stat && stat.date);
      }
      if (guild.StarboardMessages && Array.isArray(guild.StarboardMessages)) {
        guild.StarboardMessages = guild.StarboardMessages.filter(msg => msg && msg.originalMessageId);
      }
      
      await guild.save();
      return { deletedCount: 1 };
    }

    return { deletedCount: 0 };
  } catch (error) {
    throw error;
  }
}

/**
 * Remove all moderation cases for a user
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Deletion result
 */
async function removeAllModerationCases(guildId, userId) {
  try {
    // Check if Guild model is available
    if (!Guild) {
      return { deletedCount: 0 };
    }

    const guild = await Guild.findOne({ GuildID: guildId });
    if (!guild) return { deletedCount: 0 };

    const initialLength = guild.Moderation.length;
    guild.Moderation = guild.Moderation.filter(mod => mod.userId !== userId);

    const deletedCount = initialLength - guild.Moderation.length;

    if (deletedCount > 0) {
      // Clean invalid data before saving
      if (guild.MessageStats && Array.isArray(guild.MessageStats)) {
        guild.MessageStats = guild.MessageStats.filter(stat => stat && stat.date);
      }
      if (guild.StarboardMessages && Array.isArray(guild.StarboardMessages)) {
        guild.StarboardMessages = guild.StarboardMessages.filter(msg => msg && msg.originalMessageId);
      }
      
      await guild.save();
    }

    return { deletedCount };
  } catch (error) {
    throw error;
  }
}

/**
 * Save user roles (for jail system)
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @param {Array} roles - Array of role IDs
 * @returns {Promise<void>}
 */
async function saveUserRoles(guildId, userId, roles) {
  try {
    // Store roles as a special moderation case type
    await addModerationCase(
      guildId,
      userId,
      'system',
      'role_save',
      JSON.stringify(roles),
      null
    );
  } catch (error) {
    throw error;
  }
}

/**
 * Get saved user roles (for jail system)
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of role IDs
 */
async function getSavedUserRoles(guildId, userId) {
  try {
    // Check if Guild model is available
    if (!Guild) {
      return [];
    }

    const guild = await Guild.findOne({ GuildID: guildId });
    if (!guild) return [];

    const roleCase = guild.Moderation.find(mod =>
      mod.userId === userId && mod.action === 'role_save'
    );

    if (roleCase) {
      return JSON.parse(roleCase.reason);
    }

    return [];
  } catch (error) {
    throw error;
  }
}

/**
 * Remove saved user roles (for jail system)
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function removeSavedUserRoles(guildId, userId) {
  try {
    // Check if Guild model is available
    if (!Guild) {
      return;
    }

    const guild = await Guild.findOne({ GuildID: guildId });
    if (!guild) return;

    guild.Moderation = guild.Moderation.filter(mod =>
      !(mod.userId === userId && mod.action === 'role_save')
    );

    // Clean invalid data before saving
    if (guild.MessageStats && Array.isArray(guild.MessageStats)) {
      guild.MessageStats = guild.MessageStats.filter(stat => stat && stat.date);
    }
    if (guild.StarboardMessages && Array.isArray(guild.StarboardMessages)) {
      guild.StarboardMessages = guild.StarboardMessages.filter(msg => msg && msg.originalMessageId);
    }

    await guild.save();
  } catch (error) {
    throw error;
  }
}

module.exports = {
  // Connection functions
  initializeDatabase,
  isDatabaseReady,
  isDatabaseFullyInitialized,
  waitForDatabaseReady,
  disconnectDatabase,

  // Data initialization functions
  ensureGuildData,
  ensureUserData,
  ensureSystemData,

  // Moderation functions
  addModerationCase,
  getModerationHistory,
  getModerationCase,
  getModerationHistoryByAction,
  getModerationHistoryByModerator,
  removeModerationCase,
  removeAllModerationCases,
  saveUserRoles,
  getSavedUserRoles,
  removeSavedUserRoles,

  // Model access functions
  getModels() {
    if (!isDatabaseFullyReady) {
      return null;
    }
    return { User, Guild, System };
  },

  // Model getters (since models are created dynamically)
  get User() { return User; },
  get Guild() { return Guild; },
  get System() { return System; },

  // Deprecated model aliases for backward compatibility
  // These should be migrated to use cache system instead
  get AFK() { return Guild; }, // AFK data is now stored in Guild.AFK array
  get Forcenick() { return Guild; }, // ForceNick data is now stored in Guild.ForceNick array
  get Autorole() { return Guild; }, // AutoRoles data is now stored in Guild.AutoRoles array
  get Autoresponder() { return Guild; }, // AutoResponder data is now stored in Guild.AutoResponder array
  get Autoreact() { return Guild; } // AutoReact data is now stored in Guild.AutoReact array
};
