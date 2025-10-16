/**
 * TTL-based In-Memory Cache System
 * Simple, fast cache with automatic expiration and background database sync
 */
class TTLCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.defaultTTL = options.defaultTTL || 30 * 60 * 1000; // 30 minutes default
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 minutes cleanup
    this.maxSize = options.maxSize || 10000; // Max entries to prevent memory issues
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      cleanups: 0
    };
    
    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if expired/missing
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }
    
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl = this.defaultTTL) {
    // Check max size and evict oldest if needed
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now()
    });
    
    this.stats.sets++;
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key existed
   */
  delete(key) {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    
    if (existed) {
      this.stats.deletes++;
    }
    
    return existed;
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and is valid
   */
  has(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.evictions++;
      return false;
    }
    
    return true;
  }

  /**
   * Get all keys (non-expired only)
   * @returns {string[]} Array of valid keys
   */
  keys() {
    const validKeys = [];
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now <= entry.expiresAt) {
        validKeys.push(key);
      }
    }
    
    return validKeys;
  }

  /**
   * Get cache size (including expired entries)
   * @returns {number} Number of entries
   */
  size() {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  /**
   * Clear all entries
   */
  clear() {
    this.cache.clear();
    this.stats.deletes += this.cache.size;
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Manual cleanup of expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    this.stats.cleanups++;
    this.stats.evictions += cleaned;
    
    return cleaned;
  }

  /**
   * Evict oldest entry when max size reached
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Shutdown cache and cleanup
   */
  shutdown() {
    this.stopCleanupTimer();
    this.clear();
  }
}

module.exports = TTLCache;
