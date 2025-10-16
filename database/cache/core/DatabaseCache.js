const TTLCache = require('./TTLCache');

/**
 * Database-aware TTL Cache
 * Extends TTLCache with database read/write capabilities
 */
class DatabaseCache extends TTLCache {
  constructor(options = {}) {
    super(options);

    this.modelName = options.modelName;
    this.keyField = options.keyField || '_id';
    this.database = options.database || 'local'; // 'global' or 'local'
    this.writeQueue = new Map(); // Queue for background writes
    this.writeInterval = options.writeInterval || 30000; // 30 seconds
    this.batchSize = options.batchSize || 50; // Max writes per batch
    this.writesEnabled = false; // Disable writes during startup

    // Note: Using write-through strategy instead of background writes
  }

  /**
   * Get model instance for database operations
   * @returns {Model} Mongoose model
   */
  getModel() {
    try {
      const { getModels } = require('../../index');
      const models = getModels();
      
      if (!models) {
        return null;
      }
      
      return models[this.modelName];
    } catch (error) {
      return null;
    }
  }

  /**
   * Get value from cache, fallback to database
   * @param {string} key - Cache key
   * @returns {Promise<*>} Cached value or database value
   */
  async get(key) {
    // Track access for warming optimization
    this.trackAccess(key);

    // Try cache first
    const cached = super.get(key);
    if (cached !== null) {
      return cached;
    }

    // Fallback to database
    try {
      const Model = this.getModel();
      if (!Model) {
        return null;
      }

      const query = {};
      query[this.keyField] = key;

      const doc = await Model.findOne(query);
      if (doc) {
        const result = doc.toObject();
        // Cache the result
        super.set(key, result);
        return result;
      }

      return null;
    } catch (error) {
      console.error(`DatabaseCache: Error fetching ${this.modelName} with ${this.keyField}=${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set value in cache and write to database
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl) {
    // Update cache immediately
    super.set(key, value, ttl);

    // Write to database immediately if writes are enabled (write-through)
    if (this.writesEnabled) {
      this.writeToDatabase(key, value);
    }
  }

  /**
   * Write to database immediately
   * @param {string} key - Cache key
   * @param {*} value - Value to write
   */
  async writeToDatabase(key, value) {
    try {
      const Model = this.getModel();
      if (Model) {
        const query = {};
        query[this.keyField] = key;

        await Model.updateOne(query, value, { upsert: true });
      }
    } catch (error) {
      // Silently handle database errors - cache is still updated
      console.error(`DatabaseCache: Error writing document for ${this.modelName}:`, error.message);
    }
  }

  // Background write methods removed - using write-through strategy

  /**
   * Force flush - no-op for write-through cache
   */
  async flush() {
    // No-op for write-through cache - all writes are immediate
  }

  /**
   * Delete from cache and database
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(key) {
    // Remove from cache
    const existed = super.delete(key);
    
    // Remove from write queue
    this.writeQueue.delete(key);
    
    // Delete from database
    try {
      const Model = this.getModel();
      if (Model) {
        const query = {};
        query[this.keyField] = key;
        await Model.deleteOne(query);
      }
    } catch (error) {
      console.error(`DatabaseCache: Error deleting ${this.modelName} with ${this.keyField}=${key}:`, error.message);
    }
    
    return existed;
  }

  /**
   * Get field from cached document
   * @param {string} key - Document key
   * @param {string} field - Field name
   * @returns {Promise<*>} Field value
   */
  async getField(key, field) {
    const doc = await this.get(key);
    return doc ? doc[field] : null;
  }

  /**
   * Set field in cached document
   * @param {string} key - Document key
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @returns {Promise<boolean>} Success status
   */
  async setField(key, field, value) {
    const doc = await this.get(key) || {};
    doc[field] = value;

    // Update cache immediately
    super.set(key, doc);

    // Write to database immediately if writes are enabled (write-through)
    if (this.writesEnabled) {
      try {
        const Model = this.getModel();
        if (Model) {
          const query = {};
          query[this.keyField] = key;

          await Model.updateOne(query, { $set: { [field]: value } }, { upsert: true });
        }
      } catch (error) {
        // Silently handle database errors - cache is still updated
        console.error(`DatabaseCache: Error writing field ${field} for ${this.modelName}:`, error.message);
      }
    }

    return true;
  }

  // Field update queuing removed - using write-through strategy

  /**
   * Enable background writes
   */
  enableWrites() {
    this.writesEnabled = true;
  }

  /**
   * Disable background writes
   */
  disableWrites() {
    this.writesEnabled = false;
  }

  /**
   * Check if writes are enabled
   */
  areWritesEnabled() {
    return this.writesEnabled;
  }

  /**
   * Batch get operation with database fallback
   * @param {string[]} keys - Array of cache keys
   * @returns {Promise<Object>} Object with key-value pairs
   */
  async mget(keys) {
    const result = {};
    const missingKeys = [];

    // Check cache first
    for (const key of keys) {
      const cached = super.get(key);
      if (cached !== null) {
        result[key] = cached;
      } else {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length === 0) {
      return result;
    }

    // Fetch missing keys from database
    try {
      const Model = this.getModel();
      if (!Model) {
        return result;
      }

      const query = {};
      query[this.keyField] = { $in: missingKeys };

      const docs = await Model.find(query).lean();

      for (const doc of docs) {
        const key = doc[this.keyField];
        const value = doc;
        result[key] = value;
        // Cache the result
        super.set(key, value);
      }

      return result;
    } catch (error) {
      console.error(`DatabaseCache: Error batch fetching ${this.modelName}:`, error.message);
      return result;
    }
  }

  /**
   * Batch set operation with database write
   * @param {Object} keyValuePairs - Object with key-value pairs
   * @param {number} ttl - TTL in milliseconds
   * @returns {Promise<boolean>} Success status
   */
  async mset(keyValuePairs, ttl) {
    // Update cache
    for (const [key, value] of Object.entries(keyValuePairs)) {
      super.set(key, value, ttl);
    }

    // Write to database if writes are enabled
    if (this.writesEnabled) {
      await this.batchWriteToDatabase(keyValuePairs);
    }

    return true;
  }

  /**
   * Batch write to database
   * @param {Object} keyValuePairs - Object with key-value pairs
   */
  async batchWriteToDatabase(keyValuePairs) {
    try {
      const Model = this.getModel();
      if (!Model) {
        return;
      }

      const operations = [];
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const query = {};
        query[this.keyField] = key;

        operations.push({
          updateOne: {
            filter: query,
            update: value,
            upsert: true
          }
        });
      }

      if (operations.length > 0) {
        await Model.bulkWrite(operations, { ordered: false });
      }
    } catch (error) {
      console.error(`DatabaseCache: Error batch writing ${this.modelName}:`, error.message);
    }
  }

  /**
   * Track access for warming optimization
   * @param {string} key - Cache key
   */
  trackAccess(key) {
    try {
      const { getCacheManager } = require('./CacheManager');
      const cacheManager = getCacheManager();

      // Determine cache type from model name
      const cacheType = this.modelName.toLowerCase();
      cacheManager.trackAccess(cacheType, key);
    } catch (error) {
      // Silent failure - tracking is optional
    }
  }

  /**
   * Shutdown cache
   */
  async shutdown() {
    // No background processes to stop in write-through cache
    super.shutdown();
  }
}

module.exports = DatabaseCache;
