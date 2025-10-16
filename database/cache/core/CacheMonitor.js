const chalk = require('chalk');

/**
 * Cache Performance Monitor
 * Provides comprehensive monitoring and metrics for cache system
 */
class CacheMonitor {
  constructor(cacheManager) {
    this.cacheManager = cacheManager;
    this.metrics = {
      startTime: Date.now(),
      intervals: {
        minute: new Map(),
        hour: new Map(),
        day: new Map()
      },
      alerts: [],
      thresholds: {
        hitRateWarning: 80, // Warn if hit rate below 80%
        hitRateCritical: 60, // Critical if hit rate below 60%
        memoryWarning: 100 * 1024 * 1024, // 100MB
        memoryCritical: 200 * 1024 * 1024, // 200MB
        errorRateWarning: 5, // 5% error rate
        errorRateCritical: 10 // 10% error rate
      }
    };

    this.monitoringInterval = null;
    this.reportingInterval = null;
  }

  /**
   * Start monitoring
   * @param {Object} options - Monitoring options
   */
  start(options = {}) {
    const monitorInterval = options.monitorInterval || 60000; // 1 minute
    const reportInterval = options.reportInterval || 300000; // 5 minutes

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, monitorInterval);

    // Start periodic reporting
    this.reportingInterval = setInterval(() => {
      this.generateReport();
    }, reportInterval);

    console.log(chalk.blue('📊 Cache monitoring started'));
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = null;
    }

    console.log(chalk.yellow('📊 Cache monitoring stopped'));
  }

  /**
   * Collect current metrics
   */
  collectMetrics() {
    const timestamp = Date.now();
    const stats = this.cacheManager.getStats();
    
    // Store metrics for different time intervals
    this.storeMetrics('minute', timestamp, stats);
    this.storeMetrics('hour', timestamp, stats);
    this.storeMetrics('day', timestamp, stats);

    // Check for alerts
    this.checkAlerts(stats);

    // Cleanup old metrics
    this.cleanupOldMetrics();
  }

  /**
   * Store metrics for a specific interval
   * @param {string} interval - Time interval (minute, hour, day)
   * @param {number} timestamp - Current timestamp
   * @param {Object} stats - Cache statistics
   */
  storeMetrics(interval, timestamp, stats) {
    const intervalMap = this.metrics.intervals[interval];
    const key = this.getIntervalKey(timestamp, interval);
    
    if (!intervalMap.has(key)) {
      intervalMap.set(key, {
        timestamp,
        samples: [],
        aggregated: null
      });
    }

    intervalMap.get(key).samples.push(stats);
  }

  /**
   * Get interval key for grouping metrics
   * @param {number} timestamp - Timestamp
   * @param {string} interval - Interval type
   * @returns {string} Interval key
   */
  getIntervalKey(timestamp, interval) {
    const date = new Date(timestamp);
    
    switch (interval) {
      case 'minute':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
      case 'hour':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
      case 'day':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      default:
        return timestamp.toString();
    }
  }

  /**
   * Check for performance alerts
   * @param {Object} stats - Current cache statistics
   */
  checkAlerts(stats) {
    const alerts = [];

    // Check hit rates
    for (const [cacheType, cacheStats] of Object.entries(stats)) {
      if (cacheType === 'batch' || cacheType === 'preloader') continue;

      const hitRate = this.parseHitRate(cacheStats.hitRate);

      if (hitRate < this.metrics.thresholds.hitRateCritical) {
        alerts.push({
          type: 'CRITICAL',
          category: 'HIT_RATE',
          message: `${cacheType} cache hit rate critically low: ${hitRate}%`,
          timestamp: Date.now(),
          value: hitRate,
          threshold: this.metrics.thresholds.hitRateCritical
        });
      } else if (hitRate < this.metrics.thresholds.hitRateWarning) {
        alerts.push({
          type: 'WARNING',
          category: 'HIT_RATE',
          message: `${cacheType} cache hit rate low: ${hitRate}%`,
          timestamp: Date.now(),
          value: hitRate,
          threshold: this.metrics.thresholds.hitRateWarning
        });
      }

      // Check error rates
      if (cacheStats.errors) {
        const totalRequests = (cacheStats.hits || 0) + (cacheStats.misses || 0);
        const errors = cacheStats.errors || 0;
        const errorRate = totalRequests > 0 ? (errors / totalRequests * 100) : 0;

        if (errorRate > this.metrics.thresholds.errorRateCritical) {
          alerts.push({
            type: 'CRITICAL',
            category: 'ERROR_RATE',
            message: `${cacheType} cache error rate critically high: ${errorRate.toFixed(2)}%`,
            timestamp: Date.now(),
            value: errorRate,
            threshold: this.metrics.thresholds.errorRateCritical
          });
        } else if (errorRate > this.metrics.thresholds.errorRateWarning) {
          alerts.push({
            type: 'WARNING',
            category: 'ERROR_RATE',
            message: `${cacheType} cache error rate high: ${errorRate.toFixed(2)}%`,
            timestamp: Date.now(),
            value: errorRate,
            threshold: this.metrics.thresholds.errorRateWarning
          });
        }
      }
    }

    // Store new alerts
    for (const alert of alerts) {
      this.metrics.alerts.push(alert);
      this.logAlert(alert);
    }
  }

  /**
   * Parse hit rate from string percentage
   * @param {string} hitRateStr - Hit rate string (e.g., "85.5%")
   * @returns {number} Hit rate as number
   */
  parseHitRate(hitRateStr) {
    if (typeof hitRateStr === 'number') return hitRateStr;
    if (typeof hitRateStr === 'string') {
      return parseFloat(hitRateStr.replace('%', '')) || 0;
    }
    return 0;
  }

  /**
   * Log alert to console
   * @param {Object} alert - Alert object
   */
  logAlert(alert) {
    const color = alert.type === 'CRITICAL' ? chalk.red : chalk.yellow;
    const icon = alert.type === 'CRITICAL' ? '🚨' : '⚠️';
    
    console.log(color(`${icon} CACHE ALERT [${alert.type}]: ${alert.message}`));
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const stats = this.cacheManager.getStats();
    const uptime = Date.now() - this.metrics.startTime;
    
    console.log(chalk.blue('\n📊 === CACHE PERFORMANCE REPORT ==='));
    console.log(chalk.gray(`Uptime: ${this.formatDuration(uptime)}`));
    
    // Overall statistics
    for (const [cacheType, cacheStats] of Object.entries(stats)) {
      if (cacheType === 'batch' || cacheType === 'preloader') continue;

      console.log(chalk.white(`\n${cacheType.toUpperCase()} Cache:`));
      console.log(chalk.green(`  Hit Rate: ${cacheStats.hitRate || 'N/A'}`));
      console.log(chalk.gray(`  Hits: ${cacheStats.hits || 0}`));
      console.log(chalk.gray(`  Misses: ${cacheStats.misses || 0}`));
      console.log(chalk.gray(`  Size: ${cacheStats.size || 0}`));
    }

    // Recent alerts
    const recentAlerts = this.metrics.alerts.slice(-5);
    if (recentAlerts.length > 0) {
      console.log(chalk.yellow('\n⚠️ Recent Alerts:'));
      for (const alert of recentAlerts) {
        const timeAgo = this.formatDuration(Date.now() - alert.timestamp);
        console.log(chalk.gray(`  ${alert.message} (${timeAgo} ago)`));
      }
    }

    console.log(chalk.blue('=================================\n'));
  }

  /**
   * Format duration in human readable format
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Cleanup old metrics to prevent memory leaks
   */
  cleanupOldMetrics() {
    const now = Date.now();
    const retentionPeriods = {
      minute: 60 * 60 * 1000, // 1 hour
      hour: 24 * 60 * 60 * 1000, // 1 day
      day: 7 * 24 * 60 * 60 * 1000 // 1 week
    };

    for (const [interval, retention] of Object.entries(retentionPeriods)) {
      const intervalMap = this.metrics.intervals[interval];
      const cutoff = now - retention;

      for (const [key, data] of intervalMap.entries()) {
        if (data.timestamp < cutoff) {
          intervalMap.delete(key);
        }
      }
    }

    // Cleanup old alerts (keep last 100)
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts = this.metrics.alerts.slice(-100);
    }
  }

  /**
   * Get current metrics summary
   * @returns {Object} Metrics summary
   */
  getMetrics() {
    return {
      uptime: Date.now() - this.metrics.startTime,
      stats: this.cacheManager.getStats(),
      alerts: this.metrics.alerts.slice(-10), // Last 10 alerts
      thresholds: this.metrics.thresholds
    };
  }

  /**
   * Update monitoring thresholds
   * @param {Object} thresholds - New threshold values
   */
  updateThresholds(thresholds) {
    Object.assign(this.metrics.thresholds, thresholds);
    console.log(chalk.blue('📊 Cache monitoring thresholds updated'));
  }
}

module.exports = CacheMonitor;
