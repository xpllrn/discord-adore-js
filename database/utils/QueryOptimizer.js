/**
 * Query Optimizer Utility
 * Provides optimized query patterns and prevents N+1 problems
 */
class QueryOptimizer {
  constructor() {
    this.queryCache = new Map();
    this.stats = {
      optimizedQueries: 0,
      batchedQueries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Batch fetch users by IDs with caching
   * @param {Array} userIds - Array of user IDs
   * @param {Object} Model - User model
   * @param {Object} options - Query options
   * @returns {Promise<Map>} Map of userId -> user data
   */
  async batchFetchUsers(userIds, Model, options = {}) {
    if (!userIds || userIds.length === 0) return new Map();

    const uniqueIds = [...new Set(userIds)];
    const result = new Map();
    const uncachedIds = [];

    // Check cache first
    for (const id of uniqueIds) {
      const cacheKey = `user:${id}`;
      if (this.queryCache.has(cacheKey)) {
        result.set(id, this.queryCache.get(cacheKey));
        this.stats.cacheHits++;
      } else {
        uncachedIds.push(id);
        this.stats.cacheMisses++;
      }
    }

    // Fetch uncached users in batch
    if (uncachedIds.length > 0) {
      const users = await Model.find({
        UserID: { $in: uncachedIds }
      }, options.select).lean();

      // Cache and map results
      for (const user of users) {
        const cacheKey = `user:${user.UserID}`;
        this.queryCache.set(cacheKey, user);
        result.set(user.UserID, user);
      }

      this.stats.batchedQueries++;
    }

    this.stats.optimizedQueries++;
    return result;
  }

  /**
   * Batch fetch guilds by IDs with caching
   * @param {Array} guildIds - Array of guild IDs
   * @param {Object} Model - Guild model
   * @param {Object} options - Query options
   * @returns {Promise<Map>} Map of guildId -> guild data
   */
  async batchFetchGuilds(guildIds, Model, options = {}) {
    if (!guildIds || guildIds.length === 0) return new Map();

    const uniqueIds = [...new Set(guildIds)];
    const result = new Map();
    const uncachedIds = [];

    // Check cache first
    for (const id of uniqueIds) {
      const cacheKey = `guild:${id}`;
      if (this.queryCache.has(cacheKey)) {
        result.set(id, this.queryCache.get(cacheKey));
        this.stats.cacheHits++;
      } else {
        uncachedIds.push(id);
        this.stats.cacheMisses++;
      }
    }

    // Fetch uncached guilds in batch
    if (uncachedIds.length > 0) {
      const guilds = await Model.find({
        GuildID: { $in: uncachedIds }
      }, options.select).lean();

      // Cache and map results
      for (const guild of guilds) {
        const cacheKey = `guild:${guild.GuildID}`;
        this.queryCache.set(cacheKey, guild);
        result.set(guild.GuildID, guild);
      }

      this.stats.batchedQueries++;
    }

    this.stats.optimizedQueries++;
    return result;
  }

  /**
   * Optimized leaderboard query with pagination
   * @param {Object} Model - Model to query
   * @param {Object} sortField - Field to sort by
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Leaderboard results
   */
  async getLeaderboard(Model, sortField, options = {}) {
    const {
      limit = 10,
      skip = 0,
      filter = {},
      select = null,
      populateUsers = false
    } = options;

    // Build aggregation pipeline for better performance
    const pipeline = [];

    // Match stage (filtering)
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    // Sort stage
    pipeline.push({ $sort: sortField });

    // Skip and limit
    if (skip > 0) {
      pipeline.push({ $skip: skip });
    }
    pipeline.push({ $limit: limit });

    // Project stage (field selection)
    if (select) {
      pipeline.push({ $project: select });
    }

    const results = await Model.aggregate(pipeline);

    // If we need to populate user data, do it in batch
    if (populateUsers && results.length > 0) {
      const userIds = results.map(r => r.UserID || r.userId).filter(Boolean);
      if (userIds.length > 0) {
        const { getModels } = require('../index');
        const models = getModels();
        if (models && models.User) {
          const userMap = await this.batchFetchUsers(userIds, models.User, {
            select: 'UserID'
          });

          // Attach user data to results
          for (const result of results) {
            const userId = result.UserID || result.userId;
            if (userId && userMap.has(userId)) {
              result.userData = userMap.get(userId);
            }
          }
        }
      }
    }

    this.stats.optimizedQueries++;
    return results;
  }

  /**
   * Optimized search with text indexing
   * @param {Object} Model - Model to search
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async textSearch(Model, searchTerm, options = {}) {
    const {
      limit = 20,
      skip = 0,
      fields = [],
      fuzzy = false
    } = options;

    let query;

    if (fuzzy) {
      // Use regex for fuzzy search (less efficient but more flexible)
      const regexPattern = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const orConditions = fields.map(field => ({ [field]: regexPattern }));
      query = Model.find({ $or: orConditions });
    } else {
      // Use text index if available
      query = Model.find({ $text: { $search: searchTerm } });
    }

    const results = await query
      .limit(limit)
      .skip(skip)
      .lean();

    this.stats.optimizedQueries++;
    return results;
  }

  /**
   * Batch update operations
   * @param {Object} Model - Model to update
   * @param {Array} updates - Array of update operations
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Update results
   */
  async batchUpdate(Model, updates, options = {}) {
    if (!updates || updates.length === 0) return { modifiedCount: 0 };

    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: update.filter,
        update: update.update,
        upsert: options.upsert || false
      }
    }));

    const result = await Model.bulkWrite(bulkOps, {
      ordered: false, // Allow parallel execution
      ...options
    });

    this.stats.batchedQueries++;
    this.stats.optimizedQueries++;
    return result;
  }

  /**
   * Optimized count query with caching
   * @param {Object} Model - Model to count
   * @param {Object} filter - Count filter
   * @param {number} cacheTTL - Cache TTL in milliseconds
   * @returns {Promise<number>} Document count
   */
  async cachedCount(Model, filter = {}, cacheTTL = 60000) {
    const cacheKey = `count:${Model.modelName}:${JSON.stringify(filter)}`;
    
    // Check cache first
    if (this.queryCache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.queryCache.get(cacheKey);
    }

    // Perform count
    const count = await Model.countDocuments(filter);
    
    // Cache result
    this.queryCache.set(cacheKey, count);
    setTimeout(() => {
      this.queryCache.delete(cacheKey);
    }, cacheTTL);

    this.stats.cacheMisses++;
    this.stats.optimizedQueries++;
    return count;
  }

  /**
   * Optimized distinct query
   * @param {Object} Model - Model to query
   * @param {string} field - Field to get distinct values for
   * @param {Object} filter - Query filter
   * @returns {Promise<Array>} Distinct values
   */
  async getDistinct(Model, field, filter = {}) {
    const values = await Model.distinct(field, filter);
    this.stats.optimizedQueries++;
    return values;
  }

  /**
   * Clear query cache
   * @param {string} pattern - Optional pattern to match keys
   */
  clearCache(pattern = null) {
    if (pattern) {
      for (const [key] of this.queryCache) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key);
        }
      }
    } else {
      this.queryCache.clear();
    }
  }

  /**
   * Get optimizer statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.queryCache.size,
      hitRate: this.stats.cacheHits + this.stats.cacheMisses > 0
        ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      optimizedQueries: 0,
      batchedQueries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Cleanup old cache entries
   */
  cleanup() {
    // Simple cleanup - in production, you might want more sophisticated cache management
    if (this.queryCache.size > 1000) {
      const entries = Array.from(this.queryCache.entries());
      const toDelete = entries.slice(0, entries.length - 500);
      
      for (const [key] of toDelete) {
        this.queryCache.delete(key);
      }
    }
  }
}

// Global instance
let globalOptimizer = null;

/**
 * Get global query optimizer instance
 * @returns {QueryOptimizer} Optimizer instance
 */
function getQueryOptimizer() {
  if (!globalOptimizer) {
    globalOptimizer = new QueryOptimizer();
  }
  return globalOptimizer;
}

module.exports = {
  QueryOptimizer,
  getQueryOptimizer
};
