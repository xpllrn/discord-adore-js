const chalk = require('chalk');

/**
 * Graceful Shutdown Manager
 * Handles proper shutdown sequences and error recovery
 */
class GracefulShutdown {
  constructor() {
    this.shutdownHandlers = [];
    this.isShuttingDown = false;
    this.shutdownTimeout = 30000; // 30 seconds
    this.errorRecoveryHandlers = [];
    this.healthChecks = [];
    this.initialized = false;
  }

  /**
   * Initialize graceful shutdown system
   */
  initialize() {
    if (this.initialized) return;

    this.setupSignalHandlers();
    this.setupErrorHandlers();
    this.startHealthChecks();
    
    this.initialized = true;
    console.log(chalk.blue('🛡️ Graceful shutdown system initialized'));
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    // Handle SIGTERM (Docker, PM2, etc.)
    process.on('SIGTERM', () => {
      console.log(chalk.yellow('\n📡 Received SIGTERM signal'));
      this.initiateShutdown('SIGTERM');
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n📡 Received SIGINT signal'));
      this.initiateShutdown('SIGINT');
    });

    // Handle SIGUSR2 (nodemon restart)
    process.on('SIGUSR2', () => {
      console.log(chalk.yellow('\n📡 Received SIGUSR2 signal (restart)'));
      this.initiateShutdown('SIGUSR2');
    });

    // Handle SIGHUP (reload)
    process.on('SIGHUP', () => {
      console.log(chalk.blue('\n📡 Received SIGHUP signal (reload)'));
      this.handleReload();
    });
  }

  /**
   * Setup error handlers for crash recovery
   */
  setupErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error(chalk.red('💥 Uncaught Exception:'), error);
      
      try {
        await this.handleCriticalError('uncaughtException', error);
      } catch (recoveryError) {
        console.error(chalk.red('❌ Error recovery failed:'), recoveryError);
      }
      
      // Force exit after attempting recovery
      setTimeout(() => {
        process.exit(1);
      }, 5000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error(chalk.red('💥 Unhandled Rejection at:'), promise, 'reason:', reason);
      
      try {
        await this.handleCriticalError('unhandledRejection', reason);
      } catch (recoveryError) {
        console.error(chalk.red('❌ Error recovery failed:'), recoveryError);
      }
    });

    // Handle warnings
    process.on('warning', (warning) => {
      console.warn(chalk.yellow('⚠️ Process Warning:'), warning.message);
      if (warning.stack) {
        console.warn(chalk.gray(warning.stack));
      }
    });
  }

  /**
   * Add shutdown handler
   * @param {string} name - Handler name
   * @param {Function} handler - Async shutdown handler
   * @param {number} priority - Priority (lower = higher priority)
   */
  addShutdownHandler(name, handler, priority = 100) {
    this.shutdownHandlers.push({
      name,
      handler,
      priority,
      executed: false
    });

    // Sort by priority
    this.shutdownHandlers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Add error recovery handler
   * @param {string} name - Handler name
   * @param {Function} handler - Async recovery handler
   */
  addErrorRecoveryHandler(name, handler) {
    this.errorRecoveryHandlers.push({
      name,
      handler
    });
  }

  /**
   * Add health check
   * @param {string} name - Health check name
   * @param {Function} check - Async health check function
   * @param {number} interval - Check interval in milliseconds
   */
  addHealthCheck(name, check, interval = 60000) {
    this.healthChecks.push({
      name,
      check,
      interval,
      lastCheck: 0,
      healthy: true,
      consecutiveFailures: 0
    });
  }

  /**
   * Initiate graceful shutdown
   * @param {string} signal - Signal that triggered shutdown
   */
  async initiateShutdown(signal) {
    if (this.isShuttingDown) {
      console.log(chalk.yellow('⏳ Shutdown already in progress...'));
      return;
    }

    this.isShuttingDown = true;
    console.log(chalk.blue(`🔄 Initiating graceful shutdown (${signal})...`));

    const startTime = Date.now();
    let success = true;

    // Set shutdown timeout
    const timeoutHandle = setTimeout(() => {
      console.error(chalk.red('⏰ Shutdown timeout reached, forcing exit'));
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      // Execute shutdown handlers in priority order
      for (const handler of this.shutdownHandlers) {
        if (handler.executed) continue;

        try {
          console.log(chalk.gray(`  🔄 Executing shutdown handler: ${handler.name}`));
          await handler.handler();
          handler.executed = true;
          console.log(chalk.green(`  ✅ ${handler.name} shutdown complete`));
        } catch (error) {
          console.error(chalk.red(`  ❌ ${handler.name} shutdown failed:`), error.message);
          success = false;
        }
      }

      const duration = Date.now() - startTime;
      
      if (success) {
        console.log(chalk.green(`✅ Graceful shutdown completed in ${duration}ms`));
      } else {
        console.log(chalk.yellow(`⚠️ Shutdown completed with errors in ${duration}ms`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Critical error during shutdown:'), error);
    } finally {
      clearTimeout(timeoutHandle);
      process.exit(success ? 0 : 1);
    }
  }

  /**
   * Handle critical errors with recovery attempts
   * @param {string} type - Error type
   * @param {Error} error - Error object
   */
  async handleCriticalError(type, error) {
    console.log(chalk.red(`🚨 Handling critical error: ${type}`));

    // Log error details
    await this.logCriticalError(type, error);

    // Attempt recovery
    for (const recovery of this.errorRecoveryHandlers) {
      try {
        console.log(chalk.blue(`🔧 Attempting recovery: ${recovery.name}`));
        await recovery.handler(type, error);
        console.log(chalk.green(`✅ Recovery successful: ${recovery.name}`));
      } catch (recoveryError) {
        console.error(chalk.red(`❌ Recovery failed: ${recovery.name}`), recoveryError.message);
      }
    }
  }

  /**
   * Log critical error to webhook or file
   * @param {string} type - Error type
   * @param {Error} error - Error object
   */
  async logCriticalError(type, error) {
    try {
      const errorData = {
        type,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        process: {
          pid: process.pid,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          version: process.version
        }
      };

      // Try to send to error webhook
      const { logging } = require('../../config/setup');
      if (logging.errorWebhookUrl) {
        const axios = require('axios');
        await axios.post(logging.errorWebhookUrl, {
          content: `🚨 **Critical Error**: ${type}\n\`\`\`\n${error.message}\n\`\`\``,
          embeds: [{
            title: 'Critical Error Details',
            description: `**Type**: ${type}\n**Message**: ${error.message}`,
            color: 0xff0000,
            timestamp: errorData.timestamp,
            fields: [
              {
                name: 'Process Info',
                value: `PID: ${errorData.process.pid}\nUptime: ${Math.floor(errorData.process.uptime)}s\nMemory: ${Math.round(errorData.process.memoryUsage.rss / 1024 / 1024)}MB`,
                inline: true
              }
            ]
          }]
        });
      }
    } catch (logError) {
      console.error(chalk.red('Failed to log critical error:'), logError.message);
    }
  }

  /**
   * Handle reload signal
   */
  async handleReload() {
    console.log(chalk.blue('🔄 Handling reload request...'));
    
    try {
      // Reload cache system
      const { getCacheManager } = require('../cache/core/CacheManager');
      const cacheManager = getCacheManager();
      
      if (cacheManager) {
        console.log(chalk.gray('  🔄 Reloading cache data...'));
        await cacheManager.preloader.preloadAllData();
        console.log(chalk.green('  ✅ Cache reload complete'));
      }

      // Reload database connections health check
      const { healthCheck } = require('../connection');
      const dbHealth = await healthCheck();
      console.log(chalk.blue('  📊 Database health:'), dbHealth);

    } catch (error) {
      console.error(chalk.red('❌ Reload failed:'), error.message);
    }
  }

  /**
   * Start health checks
   */
  startHealthChecks() {
    setInterval(() => {
      this.runHealthChecks();
    }, 30000); // Run every 30 seconds

    // Initial health check
    setTimeout(() => {
      this.runHealthChecks();
    }, 5000);
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    const now = Date.now();

    for (const healthCheck of this.healthChecks) {
      if (now - healthCheck.lastCheck < healthCheck.interval) {
        continue;
      }

      try {
        const result = await healthCheck.check();
        
        if (result) {
          if (!healthCheck.healthy) {
            console.log(chalk.green(`💚 Health check recovered: ${healthCheck.name}`));
          }
          healthCheck.healthy = true;
          healthCheck.consecutiveFailures = 0;
        } else {
          healthCheck.healthy = false;
          healthCheck.consecutiveFailures++;
          
          if (healthCheck.consecutiveFailures === 1) {
            console.warn(chalk.yellow(`💛 Health check failed: ${healthCheck.name}`));
          } else if (healthCheck.consecutiveFailures >= 3) {
            console.error(chalk.red(`💔 Health check critical: ${healthCheck.name} (${healthCheck.consecutiveFailures} failures)`));
          }
        }
        
        healthCheck.lastCheck = now;
      } catch (error) {
        healthCheck.healthy = false;
        healthCheck.consecutiveFailures++;
        console.error(chalk.red(`💔 Health check error: ${healthCheck.name}`), error.message);
      }
    }
  }

  /**
   * Get system health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    return {
      overall: this.healthChecks.every(check => check.healthy),
      checks: this.healthChecks.map(check => ({
        name: check.name,
        healthy: check.healthy,
        consecutiveFailures: check.consecutiveFailures,
        lastCheck: check.lastCheck
      })),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Set shutdown timeout
   * @param {number} timeout - Timeout in milliseconds
   */
  setShutdownTimeout(timeout) {
    this.shutdownTimeout = timeout;
  }
}

// Global instance
let globalShutdownManager = null;

/**
 * Get global shutdown manager instance
 * @returns {GracefulShutdown} Shutdown manager instance
 */
function getShutdownManager() {
  if (!globalShutdownManager) {
    globalShutdownManager = new GracefulShutdown();
  }
  return globalShutdownManager;
}

module.exports = {
  GracefulShutdown,
  getShutdownManager
};
