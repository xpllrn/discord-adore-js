const DatabaseCache = require('./DatabaseCache');
const DataPreloader = require('./DataPreloader');
const BatchOperations = require('./BatchOperations');
const CacheMonitor = require('./CacheMonitor');
const CacheWarmer = require('./CacheWarmer');

/**
 * Cache Manager
 * Coordinates all cache instances and handles data preloading
 */
class CacheManager {
  constructor() {
    this.initialized = false;
    this.preloader = null;
    
    // Create cache instances for different data types
    this.guildCache = new DatabaseCache({
      modelName: 'Guild',
      keyField: 'GuildID',
      database: 'local',
      defaultTTL: 60 * 60 * 1000, // 1 hour
      writeInterval: 30000, // 30 seconds
      maxSize: 5000
    });
    
    this.userCache = new DatabaseCache({
      modelName: 'User',
      keyField: 'UserID',
      database: 'global',
      defaultTTL: 45 * 60 * 1000, // 45 minutes
      writeInterval: 30000, // 30 seconds
      maxSize: 10000
    });
    
    this.systemCache = new DatabaseCache({
      modelName: 'System',
      keyField: '_id',
      database: 'global',
      defaultTTL: 120 * 60 * 1000, // 2 hours
      writeInterval: 60000, // 1 minute
      maxSize: 100
    });
    
    // Initialize preloader, batch operations, monitoring, and warming
    this.preloader = new DataPreloader(this);
    this.batchOps = new BatchOperations(this);
    this.monitor = new CacheMonitor(this);
    this.warmer = new CacheWarmer(this);
  }

  /**
   * Initialize cache system (preloading happens separately)
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      console.log('🚀 Initializing TTL Cache System...');

      this.initialized = true;
      console.log('✅ TTL Cache System initialized successfully');

      // Start monitoring and warming
      this.monitor.start({
        monitorInterval: 60000, // 1 minute
        reportInterval: 300000  // 5 minutes
      });

      this.warmer.start();

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize TTL Cache System:', error.message);
      return false;
    }
  }

  /**
   * Get guild data
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Guild data
   */
  async getGuild(guildId) {
    return await this.guildCache.get(guildId);
  }

  /**
   * Set guild data
   * @param {string} guildId - Guild ID
   * @param {Object} data - Guild data
   */
  setGuild(guildId, data) {
    this.guildCache.set(guildId, data);
  }

  /**
   * Get guild field
   * @param {string} guildId - Guild ID
   * @param {string} field - Field name
   * @returns {Promise<*>} Field value
   */
  async getGuildField(guildId, field) {
    return await this.guildCache.getField(guildId, field);
  }

  /**
   * Set guild field
   * @param {string} guildId - Guild ID
   * @param {string} field - Field name
   * @param {*} value - Field value
   */
  async setGuildField(guildId, field, value) {
    return await this.guildCache.setField(guildId, field, value);
  }

  /**
   * Get user data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User data
   */
  async getUser(userId) {
    return await this.userCache.get(userId);
  }

  /**
   * Set user data
   * @param {string} userId - User ID
   * @param {Object} data - User data
   */
  setUser(userId, data) {
    this.userCache.set(userId, data);
  }

  /**
   * Get user field
   * @param {string} userId - User ID
   * @param {string} field - Field name
   * @returns {Promise<*>} Field value
   */
  async getUserField(userId, field) {
    return await this.userCache.getField(userId, field);
  }

  /**
   * Set user field
   * @param {string} userId - User ID
   * @param {string} field - Field name
   * @param {*} value - Field value
   */
  async setUserField(userId, field, value) {
    return await this.userCache.setField(userId, field, value);
  }

  /**
   * Get system data
   * @param {string} key - System key (default: 'system')
   * @returns {Promise<Object>} System data
   */
  async getSystem(key = 'system') {
    return await this.systemCache.get(key);
  }

  /**
   * Set system data
   * @param {string} key - System key
   * @param {Object} data - System data
   */
  setSystem(key, data) {
    this.systemCache.set(key, data);
  }

  /**
   * Get system field
   * @param {string} key - System key
   * @param {string} field - Field name
   * @returns {Promise<*>} Field value
   */
  async getSystemField(key, field) {
    return await this.systemCache.getField(key, field);
  }

  /**
   * Set system field
   * @param {string} key - System key
   * @param {string} field - Field name
   * @param {*} value - Field value
   */
  async setSystemField(key, field, value) {
    return await this.systemCache.setField(key, field, value);
  }

  /**
   * Get cache statistics
   * @returns {Object} Combined statistics
   */
  getStats() {
    return {
      guild: this.guildCache.getStats(),
      user: this.userCache.getStats(),
      system: this.systemCache.getStats(),
      preloader: this.preloader.getStats()
    };
  }

  /**
   * Flush all pending writes
   */
  async flush() {
    await Promise.all([
      this.guildCache.flush(),
      this.userCache.flush(),
      this.systemCache.flush()
    ]);
  }

  /**
   * Reload collection data
   * @param {string} collection - Collection name
   */
  async reloadCollection(collection) {
    await this.preloader.reloadCollection(collection);
  }

  /**
   * Check if cache system is ready
   * @returns {boolean} True if initialized and data loaded
   */
  isReady() {
    return this.initialized && this.preloader.isLoaded();
  }

  /**
   * Enable background writes for all caches
   */
  enableWrites() {
    this.guildCache.enableWrites();
    this.userCache.enableWrites();
    this.systemCache.enableWrites();
  }

  /**
   * Disable background writes for all caches
   */
  disableWrites() {
    this.guildCache.disableWrites();
    this.userCache.disableWrites();
    this.systemCache.disableWrites();
    console.log('⏸️ Background database writes disabled');
  }

  /**
   * Batch get operation across multiple cache types
   * @param {Object} requests - Object with cache type as key and array of keys as value
   * @returns {Promise<Object>} Results grouped by cache type
   */
  async batchGet(requests) {
    return await this.batchOps.batchGet(requests);
  }

  /**
   * Batch set operation across multiple cache types
   * @param {Object} requests - Object with cache type as key and key-value pairs as value
   * @param {Object} options - TTL and other options
   * @returns {Promise<boolean>} Success status
   */
  async batchSet(requests, options = {}) {
    return await this.batchOps.batchSet(requests, options);
  }

  /**
   * Batch delete operation across multiple cache types
   * @param {Object} requests - Object with cache type as key and array of keys as value
   * @returns {Promise<boolean>} Success status
   */
  async batchDelete(requests) {
    return await this.batchOps.batchDelete(requests);
  }

  /**
   * Batch warm cache with database data
   * @param {Object} requests - Object with cache type and query criteria
   * @returns {Promise<Object>} Warmed data statistics
   */
  async batchWarmCache(requests) {
    return await this.batchOps.batchWarmCache(requests);
  }

  /**
   * Batch invalidate cache entries
   * @param {Object} patterns - Object with cache type and invalidation patterns
   * @returns {Promise<Object>} Invalidation statistics
   */
  async batchInvalidate(patterns) {
    return await this.batchOps.batchInvalidate(patterns);
  }

  /**
   * Get comprehensive cache statistics including batch operations
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      guild: this.guildCache.getStats(),
      user: this.userCache.getStats(),
      system: this.systemCache.getStats(),
      batch: this.batchOps.getStats(),
      preloader: this.preloader.getStats()
    };
  }

  /**
   * Get monitoring metrics
   * @returns {Object} Monitoring metrics
   */
  getMonitoringMetrics() {
    return this.monitor.getMetrics();
  }

  /**
   * Update monitoring thresholds
   * @param {Object} thresholds - New threshold values
   */
  updateMonitoringThresholds(thresholds) {
    this.monitor.updateThresholds(thresholds);
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport() {
    this.monitor.generateReport();
  }

  /**
   * Track cache access for warming optimization
   * @param {string} cacheType - Cache type (guild, user, system)
   * @param {string} key - Cache key
   */
  trackAccess(cacheType, key) {
    this.warmer.trackAccess(cacheType, key);
  }

  /**
   * Get cache warming statistics
   * @returns {Object} Warming statistics
   */
  getWarmingStats() {
    return this.warmer.getStats();
  }

  /**
   * Add custom warming strategy
   * @param {string} name - Strategy name
   * @param {Object} strategy - Strategy configuration
   */
  addWarmingStrategy(name, strategy) {
    this.warmer.addWarmingStrategy(name, strategy);
  }

  /**
   * Shutdown cache system
   */
  async shutdown() {
    console.log('🔄 Shutting down TTL Cache System...');

    // Stop monitoring first
    this.monitor.stop();

    await Promise.all([
      this.guildCache.shutdown(),
      this.userCache.shutdown(),
      this.systemCache.shutdown()
    ]);

    this.initialized = false;
    console.log('✅ TTL Cache System shutdown complete');
  }
}

// Global cache manager instance
let globalCacheManager = null;

/**
 * Get global cache manager instance
 * @returns {CacheManager} Cache manager instance
 */
function getCacheManager() {
  if (!globalCacheManager) {
    globalCacheManager = new CacheManager();
  }
  return globalCacheManager;
}

/**
 * Initialize global cache manager
 * @returns {Promise<boolean>} Success status
 */
async function initializeCacheManager() {
  const manager = getCacheManager();
  return await manager.initialize();
}

module.exports = {
  CacheManager,
  getCacheManager,
  initializeCacheManager
};
