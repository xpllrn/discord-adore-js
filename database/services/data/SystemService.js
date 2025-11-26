const BaseService = require('../core/BaseService');
const { ValidationError, NotFoundError, DatabaseWriteError } = require('../core/errors');

/**
 * System Service
 * Handles system-wide operations like blacklists and global settings
 * Uses efficient caching for frequently accessed system data
 */
class SystemService extends BaseService {
  constructor() {
    super({
      modelName: 'System',
      keyField: '_id',
      database: 'global',
      ttl: 120 * 60 * 1000, // 2 hours TTL for system data (longer since it changes less frequently)
      maxSize: 100 // Small cache size since system data is limited
    });

    this.initialized = true;
    this.systemKey = 'system'; // Default system document key
  }

  // ===== DATABASE OPERATIONS (BaseService Implementation) =====

  /**
   * Write system data to database
   * @param {string} key - System key
   * @param {Object} data - System data
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
      throw new DatabaseWriteError(`Failed to write system data for ${key}`, error);
    }
  }

  /**
   * Read system data from database
   * @param {string} key - System key
   * @returns {Promise<Object|null>} System data or null
   */
  async readFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      const doc = await Model.findOne(query).lean();
      return doc || null;
    } catch (error) {
      console.error(`Error reading system data for ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Delete system data from database
   * @param {string} key - System key
   * @returns {Promise<void>}
   */
  async deleteFromDatabase(key) {
    try {
      const Model = this.getModel();
      const query = { [this.keyField]: key };

      await Model.deleteOne(query);
    } catch (error) {
      throw new DatabaseWriteError(`Failed to delete system data for ${key}`, error);
    }
  }

  // ===== SYSTEM DATA OPERATIONS =====

  /**
   * Ensure system data exists with default values
   * @param {string} key - System key (default: 'system')
   * @returns {Promise<Object>} System data
   */
  async ensureSystemData(key = this.systemKey) {
    if (!key) {
      throw new ValidationError('System key is required', 'key', key);
    }

    try {
      // Try to get existing data first
      let systemData = await this.get(key);

      if (!systemData) {
        // Create default system data
        systemData = {
          _id: key,
          Blacklist: {
            users: [],
            servers: []
          },
          InstanceConfig: [],
          GlobalSettings: {},
          BotStatus: {
            version: '1.0.0',
            uptime: 0,
            guilds: 0,
            users: 0,
            lastRestart: new Date()
          },
          MaintenanceMode: {
            enabled: false,
            reason: null,
            enabledAt: null,
            enabledBy: null
          },
          Statistics: {
            totalCommands: 0,
            totalMessages: 0,
            totalUsers: 0,
            totalGuilds: 0,
            lastUpdated: new Date()
          }
        };

        // No instance config needed anymore

        // Save to database and cache
        await this.set(key, systemData);
      }

      return systemData;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to ensure system data for ${key}`, error);
    }
  }

  // ===== BLACKLIST SYSTEM =====

  /**
   * Check if user is blacklisted
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} True if user is blacklisted
   */
  async isUserBlacklisted(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const systemData = await this.ensureSystemData();
      const blacklist = systemData.Blacklist || { users: [], servers: [] };

      return blacklist.users.some(entry =>
        (typeof entry === 'string' ? entry : entry.userId) === userId
      );
    } catch (error) {
      console.error(`Error checking user blacklist for ${userId}:`, error.message);
      return false; // Default to not blacklisted on error
    }
  }

  /**
   * Check if server is blacklisted
   * @param {string} serverId - Server ID to check
   * @returns {Promise<boolean>} True if server is blacklisted
   */
  async isServerBlacklisted(serverId) {
    if (!serverId) {
      throw new ValidationError('Server ID is required', 'serverId', serverId);
    }

    try {
      const systemData = await this.ensureSystemData();
      const blacklist = systemData.Blacklist || { users: [], servers: [] };

      return blacklist.servers.some(entry =>
        (typeof entry === 'string' ? entry : entry.serverId) === serverId
      );
    } catch (error) {
      console.error(`Error checking server blacklist for ${serverId}:`, error.message);
      return false; // Default to not blacklisted on error
    }
  }

  /**
   * Check if server is blacklisted (alias for isServerBlacklisted)
   * @param {string} serverId - Server ID to check
   * @returns {Promise<boolean>} True if server is blacklisted
   */
  async getServerBlacklist(serverId) {
    return this.isServerBlacklisted(serverId);
  }

  /**
   * Check if user is blacklisted (alias for isUserBlacklisted)
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} True if user is blacklisted
   */
  async getUserBlacklist(userId) {
    return this.isUserBlacklisted(userId);
  }

  /**
   * Add user to blacklist
   * @param {string} userId - User ID to blacklist
   * @param {string} reason - Reason for blacklisting
   * @param {string} addedBy - ID of who added the blacklist
   * @returns {Promise<boolean>} Success status
   */
  async addUserToBlacklist(userId, reason, addedBy) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new ValidationError('Reason is required', 'reason', reason);
    }

    if (!addedBy) {
      throw new ValidationError('Added by ID is required', 'addedBy', addedBy);
    }

    try {
      const systemData = await this.ensureSystemData();
      const blacklist = systemData.Blacklist || { users: [], servers: [] };

      // Check if user is already blacklisted
      const existingIndex = blacklist.users.findIndex(entry =>
        (typeof entry === 'string' ? entry : entry.userId) === userId
      );

      if (existingIndex !== -1) {
        return false; // User already blacklisted
      }

      // Add user to blacklist
      blacklist.users.push({
        userId,
        reason: reason.trim(),
        addedBy,
        addedAt: new Date()
      });

      systemData.Blacklist = blacklist;
      await this.set(this.systemKey, systemData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add user ${userId} to blacklist`, error);
    }
  }

  /**
   * Add server to blacklist
   * @param {string} serverId - Server ID to blacklist
   * @param {string} reason - Reason for blacklisting
   * @param {string} addedBy - ID of who added the blacklist
   * @returns {Promise<boolean>} Success status
   */
  async addServerToBlacklist(serverId, reason, addedBy) {
    if (!serverId) {
      throw new ValidationError('Server ID is required', 'serverId', serverId);
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new ValidationError('Reason is required', 'reason', reason);
    }

    if (!addedBy) {
      throw new ValidationError('Added by ID is required', 'addedBy', addedBy);
    }

    try {
      const systemData = await this.ensureSystemData();
      const blacklist = systemData.Blacklist || { users: [], servers: [] };

      // Check if server is already blacklisted
      const existingIndex = blacklist.servers.findIndex(entry =>
        (typeof entry === 'string' ? entry : entry.serverId) === serverId
      );

      if (existingIndex !== -1) {
        return false; // Server already blacklisted
      }

      // Add server to blacklist
      blacklist.servers.push({
        serverId,
        reason: reason.trim(),
        addedBy,
        addedAt: new Date()
      });

      systemData.Blacklist = blacklist;
      await this.set(this.systemKey, systemData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to add server ${serverId} to blacklist`, error);
    }
  }

  /**
   * Remove user from blacklist
   * @param {string} userId - User ID to remove from blacklist
   * @returns {Promise<boolean>} Success status
   */
  async removeUserFromBlacklist(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId', userId);
    }

    try {
      const systemData = await this.ensureSystemData();
      const blacklist = systemData.Blacklist || { users: [], servers: [] };

      const initialLength = blacklist.users.length;
      blacklist.users = blacklist.users.filter(entry =>
        (typeof entry === 'string' ? entry : entry.userId) !== userId
      );

      if (blacklist.users.length < initialLength) {
        systemData.Blacklist = blacklist;
        await this.set(this.systemKey, systemData);
        return true;
      }

      return false; // User was not blacklisted
    } catch (error) {
      throw new DatabaseWriteError(`Failed to remove user ${userId} from blacklist`, error);
    }
  }

  /**
   * Remove server from blacklist
   * @param {string} serverId - Server ID to remove from blacklist
   * @returns {Promise<boolean>} Success status
   */
  async removeServerFromBlacklist(serverId) {
    if (!serverId) {
      throw new ValidationError('Server ID is required', 'serverId', serverId);
    }

    try {
      const systemData = await this.ensureSystemData();
      const blacklist = systemData.Blacklist || { users: [], servers: [] };

      const initialLength = blacklist.servers.length;
      blacklist.servers = blacklist.servers.filter(entry =>
        (typeof entry === 'string' ? entry : entry.serverId) !== serverId
      );

      if (blacklist.servers.length < initialLength) {
        systemData.Blacklist = blacklist;
        await this.set(this.systemKey, systemData);
        return true;
      }

      return false; // Server was not blacklisted
    } catch (error) {
      throw new DatabaseWriteError(`Failed to remove server ${serverId} from blacklist`, error);
    }
  }

  /**
   * Get blacklist information
   * @returns {Promise<Object>} Blacklist data
   */
  async getBlacklistInfo() {
    try {
      const systemData = await this.ensureSystemData();
      const blacklist = systemData.Blacklist || { users: [], servers: [] };

      return {
        users: blacklist.users,
        servers: blacklist.servers,
        totalUsers: blacklist.users.length,
        totalServers: blacklist.servers.length
      };
    } catch (error) {
      console.error('Error getting blacklist info:', error.message);
      return { users: [], servers: [], totalUsers: 0, totalServers: 0 };
    }
  }

  // ===== GLOBAL SETTINGS =====

  /**
   * Get global setting
   * @param {string} key - Setting key
   * @returns {Promise<*>} Setting value or null
   */
  async getGlobalSetting(key) {
    if (!key) {
      throw new ValidationError('Setting key is required', 'key', key);
    }

    try {
      const systemData = await this.ensureSystemData();
      const settings = systemData.GlobalSettings || {};
      return settings[key] !== undefined ? settings[key] : null;
    } catch (error) {
      console.error(`Error getting global setting ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set global setting
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   * @returns {Promise<boolean>} Success status
   */
  async setGlobalSetting(key, value) {
    if (!key) {
      throw new ValidationError('Setting key is required', 'key', key);
    }

    try {
      const systemData = await this.ensureSystemData();
      const settings = systemData.GlobalSettings || {};

      settings[key] = value;
      systemData.GlobalSettings = settings;

      await this.set(this.systemKey, systemData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set global setting ${key}`, error);
    }
  }

  /**
   * Remove global setting
   * @param {string} key - Setting key
   * @returns {Promise<boolean>} Success status
   */
  async removeGlobalSetting(key) {
    if (!key) {
      throw new ValidationError('Setting key is required', 'key', key);
    }

    try {
      const systemData = await this.ensureSystemData();
      const settings = systemData.GlobalSettings || {};

      if (settings[key] !== undefined) {
        delete settings[key];
        systemData.GlobalSettings = settings;
        await this.set(this.systemKey, systemData);
        return true;
      }

      return false; // Setting didn't exist
    } catch (error) {
      throw new DatabaseWriteError(`Failed to remove global setting ${key}`, error);
    }
  }

  /**
   * Get all global settings
   * @returns {Promise<Object>} All global settings
   */
  async getAllGlobalSettings() {
    try {
      const systemData = await this.ensureSystemData();
      return systemData.GlobalSettings || {};
    } catch (error) {
      console.error('Error getting all global settings:', error.message);
      return {};
    }
  }

  // ===== SYSTEM STATUS =====

  /**
   * Get system status
   * @returns {Promise<Object>} System status
   */
  async getSystemStatus() {
    try {
      const systemData = await this.ensureSystemData();
      return systemData.BotStatus || {
        version: '1.0.0',
        uptime: 0,
        guilds: 0,
        users: 0,
        lastRestart: new Date()
      };
    } catch (error) {
      console.error('Error getting system status:', error.message);
      return {
        version: '1.0.0',
        uptime: 0,
        guilds: 0,
        users: 0,
        lastRestart: new Date()
      };
    }
  }

  /**
   * Update system status
   * @param {Object} statusUpdate - Status update data
   * @returns {Promise<boolean>} Success status
   */
  async updateSystemStatus(statusUpdate) {
    if (!statusUpdate || typeof statusUpdate !== 'object') {
      throw new ValidationError('Status update object is required', 'statusUpdate', statusUpdate);
    }

    try {
      const systemData = await this.ensureSystemData();
      const currentStatus = systemData.BotStatus || {};

      // Merge status update with current status
      systemData.BotStatus = { ...currentStatus, ...statusUpdate };

      await this.set(this.systemKey, systemData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError('Failed to update system status', error);
    }
  }

  // ===== MAINTENANCE MODE =====

  /**
   * Check if maintenance mode is enabled
   * @returns {Promise<boolean>} True if maintenance mode is enabled
   */
  async isMaintenanceModeEnabled() {
    try {
      const systemData = await this.ensureSystemData();
      const maintenance = systemData.MaintenanceMode || { enabled: false };
      return maintenance.enabled || false;
    } catch (error) {
      console.error('Error checking maintenance mode:', error.message);
      return false;
    }
  }

  /**
   * Enable maintenance mode
   * @param {string} reason - Reason for maintenance
   * @param {string} enabledBy - ID of who enabled maintenance
   * @returns {Promise<boolean>} Success status
   */
  async enableMaintenanceMode(reason, enabledBy) {
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new ValidationError('Maintenance reason is required', 'reason', reason);
    }

    if (!enabledBy) {
      throw new ValidationError('Enabled by ID is required', 'enabledBy', enabledBy);
    }

    try {
      const systemData = await this.ensureSystemData();

      systemData.MaintenanceMode = {
        enabled: true,
        reason: reason.trim(),
        enabledAt: new Date(),
        enabledBy
      };

      await this.set(this.systemKey, systemData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError('Failed to enable maintenance mode', error);
    }
  }

  /**
   * Disable maintenance mode
   * @returns {Promise<boolean>} Success status
   */
  async disableMaintenanceMode() {
    try {
      const systemData = await this.ensureSystemData();

      systemData.MaintenanceMode = {
        enabled: false,
        reason: null,
        enabledAt: null,
        enabledBy: null
      };

      await this.set(this.systemKey, systemData);
      return true;
    } catch (error) {
      throw new DatabaseWriteError('Failed to disable maintenance mode', error);
    }
  }

  // ===== STATISTICS =====

  /**
   * Get system statistics
   * @returns {Promise<Object>} System statistics
   */
  async getSystemStatistics() {
    try {
      const systemData = await this.ensureSystemData();
      return systemData.Statistics || {
        totalCommands: 0,
        totalMessages: 0,
        totalUsers: 0,
        totalGuilds: 0,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting system statistics:', error.message);
      return {
        totalCommands: 0,
        totalMessages: 0,
        totalUsers: 0,
        totalGuilds: 0,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Update system statistics
   * @param {Object} statsUpdate - Statistics update data
   * @returns {Promise<boolean>} Success status
   */
  async updateSystemStatistics(statsUpdate) {
    if (!statsUpdate || typeof statsUpdate !== 'object') {
      throw new ValidationError('Statistics update object is required', 'statsUpdate', statsUpdate);
    }

    try {
      const systemData = await this.ensureSystemData();
      const currentStats = systemData.Statistics || {};

      // Merge stats update with current stats and update timestamp
      systemData.Statistics = {
        ...currentStats,
        ...statsUpdate,
        lastUpdated: new Date()
      };

      await this.set(this.systemKey, systemData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError('Failed to update system statistics', error);
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Get system field value
   * @param {string} field - Field name
   * @param {string} key - System key (default: 'system')
   * @returns {Promise<*>} Field value
   */
  async getSystemField(field, key = this.systemKey) {
    if (!field) {
      throw new ValidationError('Field name is required', 'field', field);
    }

    try {
      const systemData = await this.ensureSystemData(key);
      return systemData[field];
    } catch (error) {
      console.error(`Error getting field ${field} for system ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set system field value
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @param {string} key - System key (default: 'system')
   * @returns {Promise<boolean>} Success status
   */
  async setSystemField(field, value, key = this.systemKey) {
    if (!field) {
      throw new ValidationError('Field name is required', 'field', field);
    }

    try {
      const systemData = await this.ensureSystemData(key);
      systemData[field] = value;

      await this.set(key, systemData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set field ${field} for system ${key}`, error);
    }
  }

  /**
   * Get system statistics
   * @returns {Object} System service statistics
   */
  getSystemStats() {
    return {
      ...this.getCacheStats(),
      serviceName: 'SystemService',
      modelName: this.modelName,
      database: this.database,
      systemKey: this.systemKey
    };
  }
  // ===== BATCH OPERATIONS =====

  /**
   * Check if multiple users are blacklisted (batch operation with cache-first strategy)
   * @param {string[]} userIds - Array of user IDs to check
   * @returns {Promise<Map<string, boolean>>} Map of userId -> isBlacklisted
   */
  async batchIsUserBlacklisted(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new ValidationError('User IDs array is required', 'userIds', userIds);
    }

    try {
      const systemData = await this.ensureSystemData();
      const blacklist = systemData.Blacklist || { users: [], servers: [] };

      const results = new Map();
      const blacklistedUserIds = new Set(
        blacklist.users.map(entry =>
          typeof entry === 'string' ? entry : entry.userId
        )
      );

      for (const userId of userIds) {
        results.set(userId, blacklistedUserIds.has(userId));
      }

      return results;
    } catch (error) {
      console.error('Error in batch user blacklist check:', error.message);
      // Default to not blacklisted on error
      const results = new Map();
      for (const userId of userIds) {
        results.set(userId, false);
      }
      return results;
    }
  }

  /**
   * Check if multiple servers are blacklisted (batch operation)
   * @param {string[]} serverIds - Array of server IDs to check
   * @returns {Promise<Map<string, boolean>>} Map of serverId -> isBlacklisted
   */
  async batchIsServerBlacklisted(serverIds) {
    if (!Array.isArray(serverIds) || serverIds.length === 0) {
      throw new ValidationError('Server IDs array is required', 'serverIds', serverIds);
    }

    try {
      const systemData = await this.ensureSystemData();
      const blacklist = systemData.Blacklist || { users: [], servers: [] };

      const results = new Map();
      const blacklistedServerIds = new Set(
        blacklist.servers.map(entry =>
          typeof entry === 'string' ? entry : entry.serverId
        )
      );

      for (const serverId of serverIds) {
        results.set(serverId, blacklistedServerIds.has(serverId));
      }

      return results;
    } catch (error) {
      console.error('Error in batch server blacklist check:', error.message);
      // Default to not blacklisted on error
      const results = new Map();
      for (const serverId of serverIds) {
        results.set(serverId, false);
      }
      return results;
    }
  }

  // ===== INSTANCE CONFIGURATION =====

  /**
   * Get instance configuration by instance ID
   * @param {string} instanceId - Instance ID
   * @returns {Promise<Object|null>} Instance configuration or null
   */
  async getInstanceConfig(instanceId) {
    if (!instanceId) {
      throw new ValidationError('Instance ID is required', 'instanceId', instanceId);
    }

    try {
      const systemData = await this.ensureSystemData();
      const instanceConfigs = systemData.InstanceConfig || [];

      return instanceConfigs.find(config => config.instanceId === instanceId) || null;
    } catch (error) {
      console.error(`Error getting instance config for ${instanceId}:`, error.message);
      return null;
    }
  }

  /**
   * Set or update instance configuration
   * @param {string} instanceId - Instance ID
   * @param {Object} config - Instance configuration
   * @returns {Promise<boolean>} Success status
   */
  async setInstanceConfig(instanceId, config) {
    if (!instanceId) {
      throw new ValidationError('Instance ID is required', 'instanceId', instanceId);
    }

    if (!config || typeof config !== 'object') {
      throw new ValidationError('Config object is required', 'config', config);
    }

    try {
      const systemData = await this.ensureSystemData();
      const instanceConfigs = systemData.InstanceConfig || [];

      const existingIndex = instanceConfigs.findIndex(c => c.instanceId === instanceId);

      if (existingIndex !== -1) {
        // Update existing config
        instanceConfigs[existingIndex] = {
          ...instanceConfigs[existingIndex],
          ...config,
          instanceId,
          lastUpdated: new Date()
        };
      } else {
        // Add new config
        instanceConfigs.push({
          instanceId,
          ...config,
          createdAt: new Date(),
          lastUpdated: new Date()
        });
      }

      systemData.InstanceConfig = instanceConfigs;
      await this.set(this.systemKey, systemData);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseWriteError(`Failed to set instance config for ${instanceId}`, error);
    }
  }

  /**
   * Remove instance configuration
   * @param {string} instanceId - Instance ID
   * @returns {Promise<boolean>} Success status
   */
  async removeInstanceConfig(instanceId) {
    if (!instanceId) {
      throw new ValidationError('Instance ID is required', 'instanceId', instanceId);
    }

    try {
      const systemData = await this.ensureSystemData();
      const instanceConfigs = systemData.InstanceConfig || [];

      const initialLength = instanceConfigs.length;
      systemData.InstanceConfig = instanceConfigs.filter(c => c.instanceId !== instanceId);

      if (systemData.InstanceConfig.length < initialLength) {
        await this.set(this.systemKey, systemData);
        return true;
      }

      return false; // Instance config didn't exist
    } catch (error) {
      throw new DatabaseWriteError(`Failed to remove instance config for ${instanceId}`, error);
    }
  }

  /**
   * Get all instance configurations
   * @returns {Promise<Array>} Array of instance configurations
   */
  async getAllInstanceConfigs() {
    try {
      const systemData = await this.ensureSystemData();
      return systemData.InstanceConfig || [];
    } catch (error) {
      console.error('Error getting all instance configs:', error.message);
      return [];
    }
  }
}

module.exports = SystemService;
