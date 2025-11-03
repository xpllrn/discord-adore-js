const mongoose = require('mongoose');
const chalk = require('chalk');
const { DatabaseConnectionError } = require('./errors');
const RetryManager = require('./RetryManager');

/**
 * Connection Manager
 * Handles database connections with retry logic and health monitoring
 */
class ConnectionManager {
  constructor() {
    this.connections = {
      user: null,   // User database connection
      guild: null   // Guild database connection
    };
    
    this.healthChecks = new Map();
    this.healthCheckInterval = null;
    this.isShuttingDown = false;
    
    // Connection statistics
    this.stats = {
      user: {
        connected: false,
        lastConnected: null,
        lastDisconnected: null,
        reconnectCount: 0,
        errorCount: 0
      },
      guild: {
        connected: false,
        lastConnected: null,
        lastDisconnected: null,
        reconnectCount: 0,
        errorCount: 0
      }
    };
  }

  /**
   * Initialize database connections with retry logic
   * @param {Object} connectionStrings - Connection configuration
   * @param {string} connectionStrings.user - User database connection string
   * @param {string} connectionStrings.guild - Guild database connection string
   * @returns {Promise<boolean>} Success status
   */
  async initialize(connectionStrings) {
    try {
      console.log(chalk.blue('🔄 Initializing database connections...'));

      // Configure mongoose settings
      mongoose.set('strictQuery', false);

      const promises = [];

      // Connect to global database if provided
      if (connectionStrings.global) {
        promises.push(this.connectWithRetry('global', connectionStrings.global));
      }

      // Connect to local database if provided
      if (connectionStrings.local) {
        promises.push(this.connectWithRetry('local', connectionStrings.local));
      }

      // Wait for all connections to establish
      await Promise.all(promises);

      // Validate that we have at least one connection
      if (!this.hasAnyConnection()) {
        throw new DatabaseConnectionError('No database connections established');
      }

      // Start health monitoring
      this.startHealthMonitoring();

      console.log(chalk.green('✅ Database connections initialized successfully'));
      return true;

    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize database connections:'), error.message);
      throw error;
    }
  }

  /**
   * Connect to database with exponential backoff retry
   * @param {string} type - Connection type ('global' or 'local')
   * @param {string} connectionString - MongoDB connection string
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<void>}
   */
  async connectWithRetry(type, connectionString, maxRetries = 3) {
    const connectOperation = async () => {
      try {
        console.log(chalk.blue(`🔄 Connecting to ${type} database...`));

        const connection = await this.createConnection(connectionString, type);
        this.connections[type] = connection;
        
        // Update statistics
        this.stats[type].connected = true;
        this.stats[type].lastConnected = new Date();
        
        // Set up connection event handlers
        this.setupConnectionHandlers(connection, type);

        console.log(chalk.green(`✅ Connected to ${type} database`));
        
      } catch (error) {
        this.stats[type].errorCount++;
        throw new DatabaseConnectionError(`Failed to connect to ${type} database: ${error.message}`);
      }
    };

    await RetryManager.executeWithRetry(connectOperation, maxRetries, {
      baseDelay: 2000, // Start with 2 second delay
      maxDelay: 30000, // Max 30 second delay
      backoffMultiplier: 2
    });
  }

  /**
   * Create a new database connection
   * @param {string} connectionString - MongoDB connection string
   * @param {string} type - Connection type for configuration
   * @returns {Promise<Connection>} Mongoose connection
   */
  async createConnection(connectionString, type) {
    const connectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 15000, // 15 second timeout
      socketTimeoutMS: 60000, // 60 second socket timeout
      maxPoolSize: type === 'global' ? 20 : 15, // Connection pool size
      minPoolSize: type === 'global' ? 5 : 3, // Minimum connections
      maxIdleTimeMS: 60000, // Close connections after 60 seconds of inactivity
      maxConnecting: type === 'global' ? 5 : 3, // Max concurrent connections
      heartbeatFrequencyMS: 10000, // Heartbeat every 10 seconds
      retryWrites: true, // Enable retryable writes
      retryReads: true, // Enable retryable reads
      readPreference: 'primaryPreferred', // Read from primary, fallback to secondary
      writeConcern: { w: 'majority', j: true }, // Ensure writes are acknowledged
      bufferCommands: false, // Disable mongoose buffering
    };

    const connection = mongoose.createConnection(connectionString, connectionOptions);

    // Wait for connection to be established with timeout
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${type} database connection timeout`));
      }, 20000); // 20 second timeout

      connection.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      connection.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    return connection;
  }

  /**
   * Set up event handlers for a database connection
   * @param {Connection} connection - Mongoose connection
   * @param {string} type - Connection type
   */
  setupConnectionHandlers(connection, type) {
    connection.on('error', (error) => {
      console.error(chalk.red(`❌ ${type} database connection error:`), error.message);
      this.stats[type].errorCount++;
    });

    connection.on('disconnected', () => {
      console.log(chalk.yellow(`⚠️ ${type} database disconnected`));
      this.stats[type].connected = false;
      this.stats[type].lastDisconnected = new Date();
    });

    connection.on('reconnected', () => {
      console.log(chalk.green(`✅ ${type} database reconnected`));
      this.stats[type].connected = true;
      this.stats[type].lastConnected = new Date();
      this.stats[type].reconnectCount++;
    });

    connection.on('fullsetup', () => {
      console.log(chalk.blue(`🔄 ${type} database replica set fully connected`));
    });

    connection.on('all', () => {
      console.log(chalk.blue(`🔄 ${type} database all servers connected`));
    });

    // Monitor connection pool events
    connection.on('connectionPoolCreated', () => {
      console.log(chalk.blue(`🔄 ${type} database connection pool created`));
    });

    connection.on('connectionPoolClosed', () => {
      console.log(chalk.yellow(`⚠️ ${type} database connection pool closed`));
    });
  }

  /**
   * Get database connection by type
   * @param {string} type - Connection type ('global' or 'local')
   * @returns {Connection} Mongoose connection
   * @throws {DatabaseConnectionError} If connection is not available
   */
  getConnection(type) {
    const connection = this.connections[type];
    
    if (!connection) {
      throw new DatabaseConnectionError(`${type} database connection not initialized`);
    }
    
    if (connection.readyState !== 1) {
      throw new DatabaseConnectionError(`${type} database not ready (state: ${connection.readyState})`);
    }
    
    return connection;
  }

  /**
   * Check if any database connection is available
   * @returns {boolean} True if at least one connection is available
   */
  hasAnyConnection() {
    return (this.connections.user && this.connections.user.readyState === 1) ||
           (this.connections.guild && this.connections.guild.readyState === 1);
  }

  /**
   * Get connection readiness status
   * @returns {Object} Connection status for each database
   */
  isReady() {
    return {
      user: this.connections.user ? this.connections.user.readyState === 1 : false,
      guild: this.connections.guild ? this.connections.guild.readyState === 1 : false,
      // Legacy compatibility
      global: this.connections.user ? this.connections.user.readyState === 1 : false,
      local: this.connections.guild ? this.connections.guild.readyState === 1 : false,
      overall: this.hasAnyConnection()
    };
  }

  /**
   * Start health monitoring for all connections
   * @param {number} interval - Health check interval in milliseconds (default: 60000)
   */
  startHealthMonitoring(interval = 60000) {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error(chalk.red('❌ Health check error:'), error.message);
      }
    }, interval);

    console.log(chalk.blue(`🔄 Started health monitoring (interval: ${interval}ms)`));
  }

  /**
   * Perform health checks on all connections
   * @returns {Promise<Object>} Health check results
   */
  async performHealthChecks() {
    const results = {
      global: false,
      local: false,
      timestamp: new Date()
    };

    // Check user connection
    if (this.connections.user) {
      try {
        if (this.connections.user.readyState === 1) {
          await this.connections.user.db.admin().ping();
          results.user = true;
          results.global = true; // Legacy compatibility
        }
      } catch (error) {
        console.warn(chalk.yellow('⚠️ User database health check failed:'), error.message);
        this.stats.user.errorCount++;
      }
    }

    // Check guild connection
    if (this.connections.guild) {
      try {
        if (this.connections.guild.readyState === 1) {
          await this.connections.guild.db.admin().ping();
          results.guild = true;
          results.local = true; // Legacy compatibility
        }
      } catch (error) {
        console.warn(chalk.yellow('⚠️ Guild database health check failed:'), error.message);
        this.stats.guild.errorCount++;
      }
    }

    // Store health check results
    this.healthChecks.set(results.timestamp.getTime(), results);

    // Keep only last 100 health checks
    if (this.healthChecks.size > 100) {
      const oldestKey = Math.min(...this.healthChecks.keys());
      this.healthChecks.delete(oldestKey);
    }

    return results;
  }

  /**
   * Get connection statistics
   * @returns {Object} Detailed connection statistics
   */
  getConnectionStats() {
    const stats = {
      connections: {},
      healthChecks: {
        total: this.healthChecks.size,
        latest: null,
        successRate: 0
      }
    };

    // Connection details
    for (const [type, connection] of Object.entries(this.connections)) {
      if (connection) {
        stats.connections[type] = {
          readyState: connection.readyState,
          name: connection.name,
          host: connection.host,
          port: connection.port,
          collections: Object.keys(connection.collections).length,
          ...this.stats[type]
        };
      } else {
        stats.connections[type] = {
          readyState: 0,
          ...this.stats[type]
        };
      }
    }

    // Health check statistics
    if (this.healthChecks.size > 0) {
      const healthCheckArray = Array.from(this.healthChecks.values());
      stats.healthChecks.latest = healthCheckArray[healthCheckArray.length - 1];
      
      const successfulChecks = healthCheckArray.filter(check => check.global || check.local).length;
      stats.healthChecks.successRate = ((successfulChecks / healthCheckArray.length) * 100).toFixed(2);
    }

    return stats;
  }

  /**
   * Gracefully disconnect from all databases
   * @param {boolean} force - Force close connections
   * @returns {Promise<void>}
   */
  async disconnect(force = false) {
    this.isShuttingDown = true;

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    console.log(chalk.blue('🔄 Disconnecting from databases...'));

    const closeOptions = force ? { force: true } : {};
    const promises = [];

    // Close user connection
    if (this.connections.user) {
      promises.push(
        this.connections.user.close(closeOptions)
          .then(() => {
            console.log(chalk.yellow('⚠️ Disconnected from user database'));
            this.connections.user = null;
            this.stats.user.connected = false;
            this.stats.user.lastDisconnected = new Date();
          })
          .catch(error => {
            console.error(chalk.red('❌ Error closing user database:'), error.message);
          })
      );
    }

    // Close guild connection
    if (this.connections.guild) {
      promises.push(
        this.connections.guild.close(closeOptions)
          .then(() => {
            console.log(chalk.yellow('⚠️ Disconnected from guild database'));
            this.connections.guild = null;
            this.stats.guild.connected = false;
            this.stats.local.lastDisconnected = new Date();
          })
          .catch(error => {
            console.error(chalk.red('❌ Error closing local database:'), error.message);
          })
      );
    }

    await Promise.all(promises);
    console.log(chalk.green('✅ Database disconnection complete'));
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      console.log(chalk.blue(`\n🔄 Received ${signal}, shutting down database connections...`));

      try {
        await this.disconnect(false);
        console.log(chalk.green('✅ Graceful database shutdown complete'));
      } catch (error) {
        console.error(chalk.red('❌ Error during graceful shutdown:'), error.message);
        // Force close on error
        await this.disconnect(true);
      }
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart
  }
}

// Global connection manager instance
let globalConnectionManager = null;

/**
 * Get global connection manager instance
 * @returns {ConnectionManager} Connection manager instance
 */
function getConnectionManager() {
  if (!globalConnectionManager) {
    globalConnectionManager = new ConnectionManager();
  }
  return globalConnectionManager;
}

module.exports = {
  ConnectionManager,
  getConnectionManager
};