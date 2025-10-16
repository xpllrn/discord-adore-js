/**
 * Batch Operations Utility
 * Provides efficient batch operations for cache and database
 */
class BatchOperations {
  constructor(cacheManager) {
    this.cacheManager = cacheManager;
    this.batchSize = 100; // Default batch size
    this.concurrency = 5; // Max concurrent operations
  }

  /**
   * Batch get operation across multiple cache types
   * @param {Object} requests - Object with cache type as key and array of keys as value
   * @returns {Promise<Object>} Results grouped by cache type
   */
  async batchGet(requests) {
    const results = {};
    const promises = [];

    for (const [cacheType, keys] of Object.entries(requests)) {
      if (keys.length === 0) continue;

      const cache = this.getCacheInstance(cacheType);
      if (!cache) continue;

      // Split into batches
      const batches = this.splitIntoBatches(keys, this.batchSize);
      
      for (const batch of batches) {
        promises.push(
          this.limitConcurrency(async () => {
            const batchResults = await cache.mget(batch);
            if (!results[cacheType]) results[cacheType] = {};
            Object.assign(results[cacheType], batchResults);
          })
        );
      }
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * Batch set operation across multiple cache types
   * @param {Object} requests - Object with cache type as key and key-value pairs as value
   * @param {Object} options - TTL and other options
   * @returns {Promise<boolean>} Success status
   */
  async batchSet(requests, options = {}) {
    const promises = [];

    for (const [cacheType, keyValuePairs] of Object.entries(requests)) {
      if (Object.keys(keyValuePairs).length === 0) continue;

      const cache = this.getCacheInstance(cacheType);
      if (!cache) continue;

      // Split into batches
      const batches = this.splitObjectIntoBatches(keyValuePairs, this.batchSize);
      
      for (const batch of batches) {
        promises.push(
          this.limitConcurrency(async () => {
            await cache.mset(batch, options);
          })
        );
      }
    }

    await Promise.all(promises);
    return true;
  }

  /**
   * Batch delete operation across multiple cache types
   * @param {Object} requests - Object with cache type as key and array of keys as value
   * @returns {Promise<boolean>} Success status
   */
  async batchDelete(requests) {
    const promises = [];

    for (const [cacheType, keys] of Object.entries(requests)) {
      if (keys.length === 0) continue;

      const cache = this.getCacheInstance(cacheType);
      if (!cache) continue;

      // Process deletions in parallel
      for (const key of keys) {
        promises.push(
          this.limitConcurrency(async () => {
            await cache.delete(key);
          })
        );
      }
    }

    await Promise.all(promises);
    return true;
  }

  /**
   * Batch warm cache with database data
   * @param {Object} requests - Object with cache type and query criteria
   * @returns {Promise<Object>} Warmed data statistics
   */
  async batchWarmCache(requests) {
    const stats = {
      totalWarmed: 0,
      byType: {}
    };

    const promises = [];

    for (const [cacheType, criteria] of Object.entries(requests)) {
      promises.push(
        this.limitConcurrency(async () => {
          const cache = this.getCacheInstance(cacheType);
          if (!cache) return;

          const Model = cache.getModel();
          if (!Model) return;

          // Fetch data from database
          const docs = await Model.find(criteria.query || {})
            .limit(criteria.limit || 1000)
            .lean();

          // Warm cache in batches
          const batches = this.splitIntoBatches(docs, this.batchSize);
          let warmed = 0;

          for (const batch of batches) {
            const keyValuePairs = {};
            
            for (const doc of batch) {
              const key = doc[cache.keyField];
              if (key) {
                keyValuePairs[key] = doc;
                warmed++;
              }
            }

            if (Object.keys(keyValuePairs).length > 0) {
              await cache.mset(keyValuePairs);
            }
          }

          stats.byType[cacheType] = warmed;
          stats.totalWarmed += warmed;
        })
      );
    }

    await Promise.all(promises);
    return stats;
  }

  /**
   * Batch invalidate cache entries based on patterns
   * @param {Object} patterns - Object with cache type and invalidation patterns
   * @returns {Promise<Object>} Invalidation statistics
   */
  async batchInvalidate(patterns) {
    const stats = {
      totalInvalidated: 0,
      byType: {}
    };

    const promises = [];

    for (const [cacheType, pattern] of Object.entries(patterns)) {
      promises.push(
        this.limitConcurrency(async () => {
          const cache = this.getCacheInstance(cacheType);
          if (!cache) return;

          let invalidated = 0;

          if (pattern.keys) {
            // Invalidate specific keys
            for (const key of pattern.keys) {
              if (await cache.delete(key)) {
                invalidated++;
              }
            }
          } else if (pattern.prefix) {
            // Invalidate by prefix (if supported)
            const keys = cache.keys ? cache.keys() : [];
            for (const key of keys) {
              if (key.startsWith(pattern.prefix)) {
                if (await cache.delete(key)) {
                  invalidated++;
                }
              }
            }
          }

          stats.byType[cacheType] = invalidated;
          stats.totalInvalidated += invalidated;
        })
      );
    }

    await Promise.all(promises);
    return stats;
  }

  /**
   * Get cache instance by type
   * @param {string} cacheType - Cache type ('guild', 'user', 'system')
   * @returns {Object} Cache instance
   */
  getCacheInstance(cacheType) {
    switch (cacheType) {
      case 'guild':
        return this.cacheManager.guildCache;
      case 'user':
        return this.cacheManager.userCache;
      case 'system':
        return this.cacheManager.systemCache;
      default:
        return null;
    }
  }

  /**
   * Split array into batches
   * @param {Array} array - Array to split
   * @param {number} batchSize - Size of each batch
   * @returns {Array} Array of batches
   */
  splitIntoBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Split object into batches
   * @param {Object} obj - Object to split
   * @param {number} batchSize - Size of each batch
   * @returns {Array} Array of batch objects
   */
  splitObjectIntoBatches(obj, batchSize) {
    const entries = Object.entries(obj);
    const batches = [];
    
    for (let i = 0; i < entries.length; i += batchSize) {
      const batchEntries = entries.slice(i, i + batchSize);
      const batchObj = Object.fromEntries(batchEntries);
      batches.push(batchObj);
    }
    
    return batches;
  }

  /**
   * Limit concurrency of operations
   * @param {Function} operation - Async operation to execute
   * @returns {Promise} Operation promise
   */
  async limitConcurrency(operation) {
    // Simple concurrency limiting - could be enhanced with a proper semaphore
    return operation();
  }

  /**
   * Get batch operation statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      batchSize: this.batchSize,
      concurrency: this.concurrency,
      // Additional stats could be added here
    };
  }

  /**
   * Configure batch operations
   * @param {Object} config - Configuration options
   */
  configure(config) {
    if (config.batchSize) this.batchSize = config.batchSize;
    if (config.concurrency) this.concurrency = config.concurrency;
  }
}

module.exports = BatchOperations;
