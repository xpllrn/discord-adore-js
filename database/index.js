const { connection } = require('./services/core/connection');

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
 * @param {string} connectionStrings.user - User database connection string
 * @param {string} connectionStrings.guild - Guild database connection string
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
  try {
    // Initialize the connection manager with connection strings
    await connection.connect(connectionStrings);
    
    // Get connections
    const connections = connection.getConnections();

    // Create models on appropriate connections
    // Support both user/guild and global/local naming
    const userConn = connections.user || connections.global;
    const guildConn = connections.guild || connections.local;

    if (userConn) {
      // User data goes to user database
      User = userConn.model('User', userSchema.schema);
      System = userConn.model('System', systemSchema.schema);
    }

    if (guildConn) {
      // Guild data goes to guild database
      Guild = guildConn.model('Guild', guildSchema.schema);

      // If no user connection, put user data in guild (backward compatibility)
      if (!userConn) {
        User = guildConn.model('User', userSchema.schema);
        System = guildConn.model('System', systemSchema.schema);
      }
    }

    // Ensure we have the required models
    if (!User || !Guild || !System) {
      isDatabaseFullyReady = false;
      return false;
    }

    // Mark database as fully ready
    isDatabaseFullyReady = true;
    return true;
    
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    isDatabaseFullyReady = false;
    return false;
  }
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
        maxTimeMS: 30000 // 30 second timeout
      }
    );

    return data;
  } catch (error) {
    // If there's still a duplicate key error, just find and return the existing record
    if (error.code === 11000) {
      try {
        return await Guild.findOne({ GuildID: guildId }).maxTimeMS(30000);
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
        maxTimeMS: 30000 // 30 second timeout
      }
    );

    return data;
  } catch (error) {
    // If there's still a duplicate key error, just find and return the existing record
    if (error.code === 11000) {
      try {
        return await User.findOne({ UserID: userId }).maxTimeMS(15000);
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

// ===== MODERATION FUNCTIONS (Deprecated - Use ModerationService) =====
// These functions are kept for backward compatibility only
// New code should use: const { getService } = require('@services'); getService('moderation')

async function addModerationCase(guildId, userId, moderatorId, action, reason, duration = null) {
  const { getService } = require('@services');
  const moderationService = getService('moderation');
  return await moderationService.addModerationCase(guildId, userId, moderatorId, action, reason, duration);
}

async function getModerationHistory(guildId, userId, action = null) {
  const { getService } = require('@services');
  const moderationService = getService('moderation');
  return await moderationService.getUserCases(guildId, userId, action);
}

async function getModerationCase(guildId, caseId) {
  const { getService } = require('@services');
  const moderationService = getService('moderation');
  return await moderationService.getCase(guildId, caseId);
}

async function getModerationHistoryByAction(guildId, userId, action) {
  return await getModerationHistory(guildId, userId, action);
}

async function getModerationHistoryByModerator(guildId, moderatorId, action = null) {
  const { getService } = require('@services');
  const moderationService = getService('moderation');
  return await moderationService.getModeratorCases(guildId, moderatorId, action);
}

async function removeModerationCase(guildId, caseId) {
  const { getService } = require('@services');
  const moderationService = getService('moderation');
  const success = await moderationService.deleteCase(guildId, caseId);
  return { deletedCount: success ? 1 : 0 };
}

async function removeAllModerationCases(guildId, userId) {
  const { getService } = require('@services');
  const moderationService = getService('moderation');
  return await moderationService.removeAllModerationCases(guildId, userId);
}

// ===== JAIL SYSTEM ROLE MANAGEMENT (Uses ModerationService) =====

async function saveUserRoles(guildId, userId, roles) {
  const { getService } = require('@services');
  const moderationService = getService('moderation');
  return await moderationService.addModerationCase(guildId, userId, 'system', 'role_save', JSON.stringify(roles), null);
}

async function getSavedUserRoles(guildId, userId) {
  const { getService } = require('@services');
  const moderationService = getService('moderation');
  const roleCases = await moderationService.getUserCases(guildId, userId, 'role_save');
  
  if (roleCases.length === 0) return [];
  
  // Get most recent role save
  const latestRoleCase = roleCases.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  
  if (latestRoleCase && latestRoleCase.reason) {
    try {
      return JSON.parse(latestRoleCase.reason);
    } catch (error) {
      console.error('[getSavedUserRoles] Error parsing saved roles:', error);
      return [];
    }
  }
  
  return [];
}

async function removeSavedUserRoles(guildId, userId) {
  const { getService } = require('@services');
  const moderationService = getService('moderation');
  
  // Get all role_save cases and delete them
  const roleCases = await moderationService.getUserCases(guildId, userId, 'role_save');
  for (const roleCase of roleCases) {
    await moderationService.deleteCase(guildId, roleCase.caseId);
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
