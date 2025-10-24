/**
 * Performance Monitor
 * Collects and tracks performance metrics for service operations
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      operations: new Map(), // operationName -> { count, totalTime, avgTime, minTime, maxTime }
      cacheHits: 0,
      cacheMisses: 0,
      databaseReads: 0,
      databaseWrites: 0,
      errors: 0,
      retries: 0
    };
    
    this.startTime = Date.now();
  }

  /**
   * Start timing an operation
   * @param {string} operationName - Name of the operation
   * @returns {Function} Function to call when operation completes
   */
  startOperation(operationName) {
    const startTime = Date.now();
    
    return (success = true) => {
      const duration = Date.now() - startTime;
      this.recordOperation(operationName, duration, success);
    };
  }

  /**
   * Record an operation's performance
   * @param {string} operationName - Name of the operation
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether operation succeeded
   */
  recordOperation(operationName, duration, success = true) {
    if (!this.metrics.operations.has(operationName)) {
      this.metrics.operations.set(operationName, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        successCount: 0,
        errorCount: 0
      });
    }

    const stats = this.metrics.operations.get(operationName);
    stats.count++;
    stats.totalTime += duration;
    stats.avgTime = stats.totalTime / stats.count;
    stats.minTime = Math.min(stats.minTime, duration);
    stats.maxTime = Math.max(stats.maxTime, duration);
    
    if (success) {
      stats.successCount++;
    } else {
      stats.errorCount++;
      this.metrics.errors++;
    }
  }

  /**
   * Record a cache hit
   */
  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }

  /**
   * Record a database read
   */
  recordDatabaseRead() {
    this.metrics.databaseReads++;
  }

  /**
   * Record a database write
   */
  recordDatabaseWrite() {
    this.metrics.databaseWrites++;
  }

  /**
   * Record a retry attempt
   */
  recordRetry() {
    this.metrics.retries++;
  }

  /**
   * Get cache hit ratio
   * @returns {number} Hit ratio as percentage (0-100)
   */
  getCacheHitRatio() {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    if (total === 0) return 0;
    return (this.metrics.cacheHits / total) * 100;
  }

  /**
   * Get all metrics
   * @returns {Object} All collected metrics
   */
  getMetrics() {
    const operations = {};
    for (const [name, stats] of this.metrics.operations) {
      operations[name] = { ...stats };
    }

    return {
      uptime: Date.now() - this.startTime,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      cacheHitRatio: this.getCacheHitRatio().toFixed(2) + '%',
      databaseReads: this.metrics.databaseReads,
      databaseWrites: this.metrics.databaseWrites,
      errors: this.metrics.errors,
      retries: this.metrics.retries,
      operations
    };
  }

  /**
   * Get top slowest operations
   * @param {number} limit - Number of operations to return
   * @returns {Array} Array of slowest operations
   */
  getSlowestOperations(limit = 10) {
    const operations = Array.from(this.metrics.operations.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);

    return operations;
  }

  /**
   * Get operations with most errors
   * @param {number} limit - Number of operations to return
   * @returns {Array} Array of operations with most errors
   */
  getMostErrorProneOperations(limit = 10) {
    const operations = Array.from(this.metrics.operations.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .filter(op => op.errorCount > 0)
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, limit);

    return operations;
  }

  /**
   * Print performance report to console
   */
  printReport() {
    const metrics = this.getMetrics();
    
    console.log('\n📊 Performance Monitor Report');
    console.log('═══════════════════════════════════════');
    console.log(`Uptime: ${(metrics.uptime / 1000 / 60).toFixed(2)} minutes`);
    console.log(`\nCache Performance:`);
    console.log(`  Hits: ${metrics.cacheHits}`);
    console.log(`  Misses: ${metrics.cacheMisses}`);
    console.log(`  Hit Ratio: ${metrics.cacheHitRatio}`);
    console.log(`\nDatabase Operations:`);
    console.log(`  Reads: ${metrics.databaseReads}`);
    console.log(`  Writes: ${metrics.databaseWrites}`);
    console.log(`\nReliability:`);
    console.log(`  Errors: ${metrics.errors}`);
    console.log(`  Retries: ${metrics.retries}`);
    
    const slowest = this.getSlowestOperations(5);
    if (slowest.length > 0) {
      console.log(`\nSlowest Operations (Top 5):`);
      slowest.forEach((op, i) => {
        console.log(`  ${i + 1}. ${op.name}: ${op.avgTime.toFixed(2)}ms avg (${op.count} calls)`);
      });
    }
    
    const errorProne = this.getMostErrorProneOperations(5);
    if (errorProne.length > 0) {
      console.log(`\nMost Error-Prone Operations:`);
      errorProne.forEach((op, i) => {
        console.log(`  ${i + 1}. ${op.name}: ${op.errorCount} errors (${op.count} calls)`);
      });
    }
    
    console.log('═══════════════════════════════════════\n');
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      operations: new Map(),
      cacheHits: 0,
      cacheMisses: 0,
      databaseReads: 0,
      databaseWrites: 0,
      errors: 0,
      retries: 0
    };
    this.startTime = Date.now();
  }

  /**
   * Get summary statistics
   * @returns {Object} Summary stats
   */
  getSummary() {
    const metrics = this.getMetrics();
    const totalOperations = Array.from(this.metrics.operations.values())
      .reduce((sum, stats) => sum + stats.count, 0);

    return {
      uptime: metrics.uptime,
      totalOperations,
      cacheHitRatio: metrics.cacheHitRatio,
      totalErrors: metrics.errors,
      totalRetries: metrics.retries,
      avgOperationsPerMinute: (totalOperations / (metrics.uptime / 1000 / 60)).toFixed(2)
    };
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;
