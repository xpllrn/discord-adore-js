/**
 * Smart Cache Implementation
 * Provides LRU eviction, TTL management, and performance monitoring
 */
class SmartCache {
  constructor(config = {}) {
    this.ttl = config.ttl || 3600000; // 1 hour default
    this.maxSize = config.maxSize || 10000;
    this.name = config.name || 'SmartCache';
    
    // Storage and metadata
    this.storage = new Map();
    this.timers = new Map();
    this.accessOrder = new Map(); // For LRU tracking
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      expirations: 0,
      size: 0
    };
    
    // Access counter for LRU
    this.accessCounter = 0;
  }

  /**
   * Set value with optional custom TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} customTTL - Custom TTL in milliseconds
   */
  set(key, value, customTTL) {
    // Check if we need to evict items due to size limit
    if (this.storage.size >= this.maxSize && !this.storage.has(key)) {
      this.evictLRU();
    }

    // Clear existing timer if key already exists
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    // Store the value with metadata
    const now = Date.now();
    this.storage.set(key, {
      value,
      timestamp: now,
      accessed: now,
      accessCount: 1
    });

    // Update access order for LRU
    this.accessOrder.set(key, ++this.accessCounter);

    // Set expiration timer
    const ttl = customTTL || this.ttl;
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.expire(key);
      }, ttl);
      this.timers.set(key, timer);
    }

    // Update statistics
    this.stats.sets++;
    this.stats.size = this.storage.size;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if not found/expired
   */
  get(key) {
    const item = this.storage.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Update access metadata for LRU
    const now = Date.now();
    item.accessed = now;
    item.accessCount++;
    this.accessOrder.set(key, ++this.accessCounter);

    this.stats.hits++;
    return item.value;
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  has(key) {
    return this.storage.has(key);
  }

  /**
   * Invalidate/delete a cache entry
   * @param {string} key - Cache key to invalidate
   * @returns {boolean} True if key was deleted
   */
  invalidate(key) {
    const existed = this.storage.delete(key);
    
    if (existed) {
      // Clean up timer
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
      
      // Clean up access order
      this.accessOrder.delete(key);
      
      // Update statistics
      this.stats.size = this.storage.size;
    }
    
    return existed;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    // Clear all data structures
    this.storage.clear();
    this.timers.clear();
    this.accessOrder.clear();
    
    // Reset statistics
    this.stats.size = 0;
    this.accessCounter = 0;
  }

  /**
   * Get current cache size
   * @returns {number} Number of items in cache
   */
  size() {
    return this.storage.size;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      name: this.name
    };
  }

  /**
   * Expire a cache entry (called by timer)
   * @param {string} key - Cache key to expire
   */
  expire(key) {
    if (this.storage.has(key)) {
      this.storage.delete(key);
      this.accessOrder.delete(key);
      this.timers.delete(key);
      
      this.stats.expirations++;
      this.stats.size = this.storage.size;
    }
  }

  /**
   * Evict least recently used item
   */
  evictLRU() {
    if (this.storage.size === 0) return;

    // Find the key with the lowest access counter (oldest access)
    let lruKey = null;
    let lruCounter = Infinity;

    for (const [key, counter] of this.accessOrder) {
      if (counter < lruCounter) {
        lruCounter = counter;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.invalidate(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Get keys sorted by access frequency (most accessed first)
   * @param {number} limit - Maximum number of keys to return
   * @returns {string[]} Array of keys sorted by access frequency
   */
  getHotKeys(limit = 10) {
    const items = Array.from(this.storage.entries())
      .map(([key, item]) => ({ key, accessCount: item.accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);

    return items.map(item => item.key);
  }

  /**
   * Cleanup expired entries (manual cleanup)
   * @returns {number} Number of entries cleaned up
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.storage) {
      // Check if item should be expired based on TTL
      if (now - item.timestamp > this.ttl) {
        this.invalidate(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get memory usage estimation
   * @returns {Object} Memory usage information
   */
  getMemoryUsage() {
    let estimatedSize = 0;
    
    for (const [key, item] of this.storage) {
      // Rough estimation: key size + value size (simplified)
      estimatedSize += key.length * 2; // UTF-16 characters
      estimatedSize += JSON.stringify(item.value).length * 2; // Rough value size
    }

    return {
      entries: this.storage.size,
      estimatedBytes: estimatedSize,
      estimatedMB: (estimatedSize / (1024 * 1024)).toFixed(2)
    };
  }
}

module.exports = SmartCache;