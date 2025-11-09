const SmartCache = require('./SmartCache');
const { ServiceError, DatabaseConnectionError, ValidationError } = require('./errors');

/**
 * Base Service Class
 * Provides write-through caching strategy and common service functionality
 * All data services extend this class for consistent behavior
 */
class BaseService {
  constructor(config = {}) {
    this.modelName = config.modelName;
    this.keyField = config.keyField || '_id';
    this.database = config.database || 'local'; // 'global' or 'local'
    
    // Initialize smart cache with service-specific configuration
    this.cache = new SmartCache({
      ttl: config.ttl || 3600000, // 1 hour default
      maxSize: config.maxSize || 10000,
      name: this.modelName || 'BaseService'
    });
    
    this.initialized = false;
  }

  /**
   * Get database model instance
   * @returns {Model} Mongoose model
   */
  getModel() {
    try {
      const { getModels } = require('../../index');
      const models = getModels();

      if (!models) {
        throw new DatabaseConnectionError('Database models not available');
      }

      const model = models[this.modelName];
      if (!model) {
        throw new DatabaseConnectionError(`Model ${this.modelName} not found`);
      }

      return model;
    } catch (error) {
      if (error instanceof DatabaseConnectionError) {
        throw error;
      }
      throw new DatabaseConnectionError(`Failed to get model ${this.modelName}: ${error.message}`);
    }
  }

  /**
   * Write-Through Caching Strategy: Database first, then cache
   * @param {string} key - Cache key
   * @param {*} data - Data to store
   * @param {number} customTTL - Custom TTL in milliseconds
   * @returns {Promise<boolean>} Success status
   */
  async set(key, data, customTTL) {
    try {
      // Step 1: Write to database first (write-through strategy)
      await this.writeToDatabase(key, data);
      
      // Step 2: Update cache only after successful database write
      this.cache.set(key, data, customTTL);
      
      return true;
    } catch (error) {
      // Immediately invalidate cache key on write failure
      this.cache.invalidate(key);
      throw error;
    }
  }

  /**
   * Cache-First Read Strategy: Cache first, then database fallback
   * @param {string} key - Cache key
   * @returns {Promise<*>} Cached or database value
   */
  async get(key) {
    try {
      // Step 1: Try cache first
      const cached = this.cache.get(key);
      if (cached !== null) {
        return cached;
      }

      // Step 2: Cache miss - fetch from database
      const data = await this.readFromDatabase(key);
      
      // Step 3: Cache the result if found
      if (data !== null) {
        this.cache.set(key, data);
      }
      
      return data;
    } catch (error) {
      // For read errors, log but don't throw unless it's a critical error
      if (error instanceof DatabaseConnectionError) {
        console.error(`Database read error for key ${key}:`, error.message);
        // Return null for database connection issues (graceful degradation)
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete from both cache and database
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async delete(key) {
    try {
      // Remove from cache immediately
      this.cache.invalidate(key);
      
      // Remove from database
      await this.deleteFromDatabase(key);
      
      return true;
    } catch (error) {
      // Cache is already invalidated, so partial success
      console.error(`Database delete error for key ${key}:`, error.message);
      throw error;
    }
  }

  /**
   * Batch get operation with cache-first strategy
   * @param {string[]} keys - Array of cache keys
   * @returns {Promise<Map<string, *>>} Map of key-value pairs
   */
  async batchGet(keys) {
    const result = new Map();
    const cacheHits = new Set();
    const cacheMisses = [];

    // Step 1: Check cache for all keys first
    for (const key of keys) {
      const cached = this.cache.get(key);
      if (cached !== null) {
        result.set(key, cached);
        cacheHits.add(key);
      } else {
        cacheMisses.push(key);
      }
    }

    // Step 2: Batch fetch cache misses from database
    if (cacheMisses.length > 0) {
      try {
        const dbResults = await this.batchReadFromDatabase(cacheMisses);
        
        // Step 3: Cache the database results
        for (const [key, value] of dbResults) {
          if (value !== null) {
            this.cache.set(key, value);
            result.set(key, value);
          }
        }
      } catch (error) {
        console.error('Batch database read error:', error.message);
        // Continue with cache hits only
      }
    }

    return result;
  }

  /**
   * Invalidate cache entry
   * @param {string} key - Cache key to invalidate
   */
  invalidateCache(key) {
    this.cache.invalidate(key);
  }

  /**
   * Clear all cache entries
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  // Abstract methods to be implemented by subclasses

  /**
   * Write data to database
   * @param {string} key - Data key
   * @param {*} data - Data to write
   * @returns {Promise<void>}
   */
  async writeToDatabase(key, data) {
    throw new Error('writeToDatabase must be implemented by subclass');
  }

  /**
   * Read data from database
   * @param {string} key - Data key
   * @returns {Promise<*>} Data or null if not found
   */
  async readFromDatabase(key) {
    throw new Error('readFromDatabase must be implemented by subclass');
  }

  /**
   * Delete data from database
   * @param {string} key - Data key
   * @returns {Promise<void>}
   */
  async deleteFromDatabase(key) {
    throw new Error('deleteFromDatabase must be implemented by subclass');
  }

  /**
   * Batch read from database
   * @param {string[]} keys - Array of keys
   * @returns {Promise<Map<string, *>>} Map of key-value pairs
   */
  async batchReadFromDatabase(keys) {
    // Default implementation: sequential reads
    const result = new Map();
    for (const key of keys) {
      try {
        const data = await this.readFromDatabase(key);
        if (data !== null) {
          result.set(key, data);
        }
      } catch (error) {
        console.error(`Error reading key ${key}:`, error.message);
      }
    }
    return result;
  }

  /**
   * Shutdown service and cleanup resources
   */
  async shutdown() {
    this.clearCache();
    this.initialized = false;
  }
}

module.exports = BaseService;