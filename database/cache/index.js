/**
 * Unified TTL Cache Interface
 * Provides a single entry point for all cache operations
 * Uses the new TTL cache system with automatic data loading
 */

const { getCacheManager } = require('./core/CacheManager');

// Auto-fetching cache wrapper that provides the same interface as before
class AutoFetchCache {
  constructor(cacheType) {
    this.cacheType = cacheType;
    this.cacheManager = getCacheManager();
  }

  // Generic method dispatcher - automatically routes to correct cache
  async getField(key, field) {
    switch (this.cacheType) {
      case 'guild':
        return await this.cacheManager.getGuildField(key, field);
      case 'user':
        return await this.cacheManager.getUserField(key, field);
      case 'system':
        return await this.cacheManager.getSystemField(key, field);
      default:
        throw new Error(`Unknown cache type: ${this.cacheType}`);
    }
  }

  async setField(key, field, value) {
    switch (this.cacheType) {
      case 'guild':
        return await this.cacheManager.setGuildField(key, field, value);
      case 'user':
        return await this.cacheManager.setUserField(key, field, value);
      case 'system':
        return await this.cacheManager.setSystemField(key, field, value);
      default:
        throw new Error(`Unknown cache type: ${this.cacheType}`);
    }
  }

  async get(key) {
    switch (this.cacheType) {
      case 'guild':
        return await this.cacheManager.getGuild(key);
      case 'user':
        return await this.cacheManager.getUser(key);
      case 'system':
        return await this.cacheManager.getSystem(key);
      default:
        throw new Error(`Unknown cache type: ${this.cacheType}`);
    }
  }

  set(key, data) {
    switch (this.cacheType) {
      case 'guild':
        return this.cacheManager.setGuild(key, data);
      case 'user':
        return this.cacheManager.setUser(key, data);
      case 'system':
        return this.cacheManager.setSystem(key, data);
      default:
        throw new Error(`Unknown cache type: ${this.cacheType}`);
    }
  }
}

// Create auto-fetching cache instances
const guildCache = new AutoFetchCache('guild');
const userCache = new AutoFetchCache('user');
const systemCache = new AutoFetchCache('system');

// For prefix and blacklist, we'll use specialized wrappers
const prefixCache = {
  async getGuildPrefix(guildId) {
    const prefix = await guildCache.getField(guildId, 'Prefix');
    return prefix || ','; // Default prefix
  },

  async getUserPrefix(userId) {
    return await userCache.getField(userId, 'SelfPrefix');
  },

  async setGuildPrefix(guildId, prefix) {
    return await guildCache.setField(guildId, 'Prefix', prefix);
  },

  async setUserPrefix(userId, prefix) {
    return await userCache.setField(userId, 'SelfPrefix', prefix);
  }
};

const blacklistCache = {
  async getUserBlacklist(userId) {
    const system = await systemCache.get('system');
    if (!system || !system.Blacklist || !system.Blacklist.users) return false;

    return system.Blacklist.users.some(entry => entry.userId === userId);
  },

  async getServerBlacklist(serverId) {
    const system = await systemCache.get('system');
    if (!system || !system.Blacklist || !system.Blacklist.servers) return false;

    return system.Blacklist.servers.some(entry => entry.serverId === serverId);
  }
};

// Export the cache instances for direct use
module.exports = {
  // Main cache instances
  guildCache,
  userCache,
  systemCache,
  prefixCache,
  blacklistCache,

  // Backward compatibility exports
  Guild: guildCache,
  User: userCache,
  System: systemCache,
  Prefix: prefixCache,
  Blacklist: blacklistCache,

  // Cache manager access
  getCacheManager
};
