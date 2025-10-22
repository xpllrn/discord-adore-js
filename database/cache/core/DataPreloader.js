/**
 * Data Preloader System
 * Loads all data from collections on startup and populates TTL cache
 */
class DataPreloader {
  constructor(cacheManager) {
    this.cacheManager = cacheManager;
    this.loadedCollections = new Set();
    this.loadStats = {
      totalDocuments: 0,
      loadTime: 0,
      collections: {}
    };
  }

  /**
   * Preload all data from all collections
   * @returns {Promise<Object>} Load statistics
   */
  async preloadAllData() {
    const startTime = Date.now();

    try {
      // Wait for models to be available (retry up to 10 times)
      let retries = 0;
      while (retries < 10) {
        const { getModels } = require('../../index');
        const models = getModels();

        if (models && models.Guild && models.User && models.System) {
          break;
        }

        retries++;
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
      }

      // Load data from each collection
      await this.preloadGuildData();
      await this.preloadUserData();
      await this.preloadSystemData();

      this.loadStats.loadTime = Date.now() - startTime;

      // Silent completion

      // Enable background writes now that preloading is complete
      this.cacheManager.enableWrites();
      console.log('✅ Cache writes enabled after successful preloading');

      return this.loadStats;
    } catch (error) {
      console.error('❌ Data preload failed:', error.message);

      // Enable writes even if preloading failed to ensure cache functionality
      this.cacheManager.enableWrites();
      console.log('⚠️ Cache writes enabled despite preload failure');

      throw error;
    }
  }

  /**
   * Preload guild data from local database
   */
  async preloadGuildData() {
    try {
      const { getModels } = require('../../index');
      const models = getModels();
      
      if (!models || !models.Guild) {
        return;
      }
      
      const guilds = await models.Guild.find({}).lean();

      let loaded = 0;
      for (const guild of guilds) {
        const key = guild.GuildID || guild._id.toString();
        this.cacheManager.guildCache.set(key, guild, 60 * 60 * 1000); // 1 hour TTL
        loaded++;
      }

      this.loadStats.collections.guilds = loaded;
      this.loadStats.totalDocuments += loaded;
      this.loadedCollections.add('guilds');
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Preload user data from global database
   */
  async preloadUserData() {
    try {
      const { getModels } = require('../../index');
      const models = getModels();
      
      if (!models || !models.User) {
        return;
      }
      
      // Load users sorted by updatedAt descending to get the most recent version of each user
      const users = await models.User.find({}).sort({ updatedAt: -1 }).lean();

      let loaded = 0;
      const loadedUserIds = new Set();
      
      for (const user of users) {
        const key = user.UserID || user._id.toString();
        
        // Only load the first (most recent) document for each user ID
        if (!loadedUserIds.has(key)) {
          this.cacheManager.userCache.set(key, user, 45 * 60 * 1000); // 45 minutes TTL
          loadedUserIds.add(key);
          loaded++;
        }
      }

      this.loadStats.collections.users = loaded;
      this.loadStats.totalDocuments += loaded;
      this.loadedCollections.add('users');
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Preload system data from global database
   */
  async preloadSystemData() {
    try {
      const { getModels } = require('../../index');
      const models = getModels();
      
      if (!models || !models.System) {
        return;
      }
      
      const systems = await models.System.find({}).lean();

      let loaded = 0;
      for (const system of systems) {
        const key = system._id || 'system';
        this.cacheManager.systemCache.set(key, system, 120 * 60 * 1000); // 2 hours TTL
        loaded++;
      }

      this.loadStats.collections.systems = loaded;
      this.loadStats.totalDocuments += loaded;
      this.loadedCollections.add('systems');
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Reload specific collection data
   * @param {string} collection - Collection name ('guilds', 'users', 'systems')
   */
  async reloadCollection(collection) {
    console.log(`🔄 Reloading ${collection} data...`);
    
    switch (collection) {
      case 'guilds':
        await this.preloadGuildData();
        break;
      case 'users':
        await this.preloadUserData();
        break;
      case 'systems':
        await this.preloadSystemData();
        break;
      default:
        throw new Error(`Unknown collection: ${collection}`);
    }
  }

  /**
   * Get preload statistics
   * @returns {Object} Load statistics
   */
  getStats() {
    return {
      ...this.loadStats,
      loadedCollections: Array.from(this.loadedCollections)
    };
  }

  /**
   * Check if data is loaded
   * @param {string} collection - Collection name (optional)
   * @returns {boolean} True if loaded
   */
  isLoaded(collection = null) {
    if (collection) {
      return this.loadedCollections.has(collection);
    }
    
    // Check if all expected collections are loaded
    const expectedCollections = ['guilds', 'users', 'systems'];
    return expectedCollections.every(col => this.loadedCollections.has(col));
  }

  /**
   * Clear preload statistics
   */
  clearStats() {
    this.loadStats = {
      totalDocuments: 0,
      loadTime: 0,
      collections: {}
    };
    this.loadedCollections.clear();
  }
}

module.exports = DataPreloader;
