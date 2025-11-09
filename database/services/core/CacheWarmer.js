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
   * Start periodic cache warming (only after startup is complete)
   * @param {Object} services - Service instances
   */
  start(services) {
    if (this.intervalId) {
      console.log('⚠️  Cache warmer already running');
      return;
    }

    // Wait for startup to complete before starting periodic updates
    setTimeout(() => {
      this.startupComplete = true;
      
      // Start periodic warming
      this.intervalId = setInterval(() => {
        this.warmSystemCache(services);
      }, this.warmInterval);

      // Do initial warm
      this.warmSystemCache(services);
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
   * Warm system-wide cache data only
   * IMPORTANT: Does NOT warm guild or user data (those remain on-demand)
   * @param {Object} services - Service instances
   */
  async warmSystemCache(services) {
    if (this.isWarming) {
      console.log('⏭️  Cache warming already in progress, skipping');
      return;
    }

    if (!this.startupComplete) {
      console.log('⏭️  Startup not complete, skipping cache warming');
      return;
    }

    this.isWarming = true;
    const startTime = Date.now();

    try {
      // Only warm system-wide data (blacklists, global settings)
      await this.warmSystemData(services.system);

      const duration = Date.now() - startTime;
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
      console.log('⏭️  System service not available');
      return;
    }

    try {
      // Warm system data (blacklists, global settings, etc.)
      // This is system-wide data that changes infrequently
      await systemService.ensureSystemData('system');
      
      // Get blacklist info to ensure it's cached
      await systemService.getBlacklistInfo();
      
      console.log('   ✓ System data warmed (blacklists, settings)');
    } catch (error) {
      console.error('   ✗ Error warming system data:', error.message);
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
   */
  async manualWarm(services) {
    await this.warmSystemCache(services);
  }
}

// Singleton instance
const cacheWarmer = new CacheWarmer();

module.exports = cacheWarmer;
