/**
 * Cache Warmer
 * Handles intelligent caching strategies for system-wide data only
 * Ensures guild and user data remains strictly on-demand (lazy loading)
 */

class CacheWarmer {
  constructor() {
    this.isWarming = false;
    this.lastWarmTime = null;
    this.warmInterval = 5 * 60 * 1000; // 5 minutes
    this.intervalId = null;
    this.startupComplete = false;
  }

  /**
   * Start cache warming once on startup (no periodic updates - cache handles itself)
   * @param {Object} services - Service instances
   * @param {Object} client - Discord client
   */
  start(services, client = null) {
    // Only warm once on startup
    setTimeout(() => {
      this.startupComplete = true;
      this.warmSystemCache(services, client);
    }, 30000); // Wait 30 seconds after startup
  }

  /**
   * Stop periodic cache warming
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Warm essential cache data once (system, guild prefixes)
   * After this, cache uses LRU + TTL to manage itself automatically
   * @param {Object} services - Service instances
   * @param {Object} client - Discord client (optional, for guild list)
   */
  async warmSystemCache(services, client = null) {
    if (this.isWarming) {
      return;
    }

    this.isWarming = true;

    try {
      // Warm system-wide data (blacklists, global settings)
      await this.warmSystemData(services.system);
      
      // Warm guild prefixes if client is available
      if (client && services.guild) {
        await this.warmGuildPrefixes(services.guild, client);
      }
      
      this.lastWarmTime = new Date();
    } catch (error) {
      console.error('Cache warmer error:', error.message);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Warm system service cache (blacklists, global settings)
   * @param {SystemService} systemService - System service instance
   */
  async warmSystemData(systemService) {
    if (!systemService) {
      return;
    }

    try {
      // Warm system data (blacklists, global settings, etc.)
      // This is system-wide data that changes infrequently
      await systemService.ensureSystemData('system');
      
      // Get blacklist info to ensure it's cached
      await systemService.getBlacklistInfo();
    } catch (error) {
      console.error('Error warming system data:', error.message);
    }
  }

  /**
   * Warm guild prefixes for all guilds the bot is in
   * @param {GuildService} guildService - Guild service instance
   * @param {Object} client - Discord client
   */
  async warmGuildPrefixes(guildService, client) {
    if (!guildService || !client || !client.guilds) {
      return;
    }

    try {
      const guildIds = Array.from(client.guilds.cache.keys());
      
      if (guildIds.length === 0) {
        return;
      }

      // Batch load guild data (just prefix and basic info)
      for (const guildId of guildIds) {
        try {
          const guild = client.guilds.cache.get(guildId);
          
          // Get guild data and add guild name as metadata
          let guildData = await guildService.get(guildId);
          if (!guildData) {
            guildData = guildService.getDefaultGuildData(guildId);
            if (guild) {
              guildData._guildName = guild.name; // Add metadata for logging
            }
            await guildService.set(guildId, guildData);
          }
        } catch (error) {
          // Skip guilds that fail to load
        }
      }
    } catch (error) {
      console.error('Error warming guild prefixes:', error.message);
    }
  }

  /**
   * Get cache warmer statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      isRunning: !!this.intervalId,
      isWarming: this.isWarming,
      lastWarmTime: this.lastWarmTime,
      warmInterval: this.warmInterval,
      startupComplete: this.startupComplete
    };
  }

  /**
   * Manually trigger cache warming
   * @param {Object} services - Service instances
   * @param {Object} client - Discord client
   */
  async manualWarm(services, client = null) {
    await this.warmSystemCache(services, client);
  }
}

// Singleton instance
const cacheWarmer = new CacheWarmer();

module.exports = cacheWarmer;
