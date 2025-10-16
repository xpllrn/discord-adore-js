/**
 * System Cache Model
 * Auto-fetching wrapper for system data using TTL cache system
 * All methods automatically handle cache-first reads and background database writes
 */
class System {
  constructor() {
    // Get the auto-fetch cache from the unified interface
    const { systemCache } = require('../index');
    this.cache = systemCache;
  }

  // ===== BLACKLIST METHODS =====
  async getUserBlacklist(userId) {
    const system = await this.cache.get('system');
    if (!system || !system.Blacklist || !system.Blacklist.users) return false;
    
    return system.Blacklist.users.some(entry => entry.userId === userId);
  }

  async getServerBlacklist(serverId) {
    const system = await this.cache.get('system');
    if (!system || !system.Blacklist || !system.Blacklist.servers) return false;
    
    return system.Blacklist.servers.some(entry => entry.serverId === serverId);
  }

  async addUserBlacklist(userId, reason, blacklistedBy) {
    const system = await this.cache.get('system') || { Blacklist: { users: [], servers: [] } };
    
    if (!system.Blacklist) system.Blacklist = { users: [], servers: [] };
    if (!system.Blacklist.users) system.Blacklist.users = [];
    
    // Remove existing entry if any
    system.Blacklist.users = system.Blacklist.users.filter(entry => entry.userId !== userId);
    
    // Add new entry
    system.Blacklist.users.push({
      userId,
      reason: reason || '...',
      blacklistedBy,
      timestamp: new Date()
    });
    
    return await this.cache.set('system', system);
  }

  async removeUserBlacklist(userId) {
    const system = await this.cache.get('system');
    if (!system || !system.Blacklist || !system.Blacklist.users) return false;
    
    const originalLength = system.Blacklist.users.length;
    system.Blacklist.users = system.Blacklist.users.filter(entry => entry.userId !== userId);
    
    if (system.Blacklist.users.length < originalLength) {
      await this.cache.set('system', system);
      return true;
    }
    
    return false;
  }

  async addServerBlacklist(serverId, reason, blacklistedBy) {
    const system = await this.cache.get('system') || { Blacklist: { users: [], servers: [] } };
    
    if (!system.Blacklist) system.Blacklist = { users: [], servers: [] };
    if (!system.Blacklist.servers) system.Blacklist.servers = [];
    
    // Remove existing entry if any
    system.Blacklist.servers = system.Blacklist.servers.filter(entry => entry.serverId !== serverId);
    
    // Add new entry
    system.Blacklist.servers.push({
      serverId,
      reason: reason || '...',
      blacklistedBy,
      timestamp: new Date()
    });
    
    return await this.cache.set('system', system);
  }

  async removeServerBlacklist(serverId) {
    const system = await this.cache.get('system');
    if (!system || !system.Blacklist || !system.Blacklist.servers) return false;
    
    const originalLength = system.Blacklist.servers.length;
    system.Blacklist.servers = system.Blacklist.servers.filter(entry => entry.serverId !== serverId);
    
    if (system.Blacklist.servers.length < originalLength) {
      await this.cache.set('system', system);
      return true;
    }
    
    return false;
  }

  async getAllUserBlacklist() {
    const system = await this.cache.get('system');
    return (system && system.Blacklist && system.Blacklist.users) ? system.Blacklist.users : [];
  }

  async getAllServerBlacklist() {
    const system = await this.cache.get('system');
    return (system && system.Blacklist && system.Blacklist.servers) ? system.Blacklist.servers : [];
  }

  // Aliases for blacklist methods to match command usage
  async getAllBlacklistedUsers() {
    return await this.getAllUserBlacklist();
  }

  async getAllBlacklistedServers() {
    return await this.getAllServerBlacklist();
  }

  // ===== INSTANCE CONFIG METHODS =====
  async getInstanceConfig(instanceId) {
    const system = await this.cache.get('system');
    if (!system || !system.InstanceConfig) return null;
    
    return system.InstanceConfig.find(config => config.instanceId === instanceId);
  }

  async setInstanceConfig(instanceId, config) {
    const system = await this.cache.get('system') || { InstanceConfig: [] };
    
    if (!system.InstanceConfig) system.InstanceConfig = [];
    
    // Remove existing config if any
    system.InstanceConfig = system.InstanceConfig.filter(c => c.instanceId !== instanceId);
    
    // Add new config
    system.InstanceConfig.push({
      instanceId,
      ...config,
      updatedAt: new Date()
    });
    
    return await this.cache.set('system', system);
  }

  async removeInstanceConfig(instanceId) {
    const system = await this.cache.get('system');
    if (!system || !system.InstanceConfig) return false;
    
    const originalLength = system.InstanceConfig.length;
    system.InstanceConfig = system.InstanceConfig.filter(c => c.instanceId !== instanceId);
    
    if (system.InstanceConfig.length < originalLength) {
      await this.cache.set('system', system);
      return true;
    }
    
    return false;
  }

  async getBotStatus(instanceId) {
    const config = await this.getInstanceConfig(instanceId);
    return config ? config.botStatus : null;
  }

  async setBotStatus(instanceId, status) {
    const config = await this.getInstanceConfig(instanceId) || {};
    config.botStatus = status;
    return await this.setInstanceConfig(instanceId, config);
  }

  async getBotName(instanceId) {
    const config = await this.getInstanceConfig(instanceId);
    return config ? config.botName : null;
  }

  async setBotName(instanceId, name) {
    const config = await this.getInstanceConfig(instanceId) || {};
    config.botName = name;
    return await this.setInstanceConfig(instanceId, config);
  }

  async getInstancePermissions(instanceId) {
    const config = await this.getInstanceConfig(instanceId);
    return config ? (config.permissions || []) : [];
  }

  async setInstancePermissions(instanceId, permissions) {
    const config = await this.getInstanceConfig(instanceId) || {};
    config.permissions = permissions;
    return await this.setInstanceConfig(instanceId, config);
  }

  // ===== GENERIC FIELD ACCESS =====
  async getField(key, field) {
    return await this.cache.getField(key, field);
  }

  async setField(key, field, value) {
    return await this.cache.setField(key, field, value);
  }

  async get(key = 'system') {
    return await this.cache.get(key);
  }

  set(key, data) {
    return this.cache.set(key, data);
  }
}

module.exports = new System();
