const mongoose = require('mongoose');
const chalk = require('chalk');

// Connection states
let connections = {
  user: null,   // User database connection
  guild: null   // Guild database connection
};

/**
 * Connect to multiple MongoDB databases
 * @param {Object} connectionStrings - Object containing connection strings
 * @param {string} connectionStrings.user - User database connection string
 * @param {string} connectionStrings.guild - Guild database connection string
 * @returns {Promise<boolean>} Connection success status
 */
async function connect(connectionStrings) {
  try {
    // Configure mongoose
    mongoose.set('strictQuery', false);

    // Connect to user database
    if (connectionStrings.user) {
      if (!connections.user) {
        try {
          connections.user = mongoose.createConnection(connectionStrings.user, {
            serverSelectionTimeoutMS: 30000, // 30 second timeout
            socketTimeoutMS: 120000, // 2 minute socket timeout
            maxPoolSize: 10, // Maintain up to 10 socket connections
            minPoolSize: 2, // Maintain at least 2 socket connections
            maxIdleTimeMS: 120000, // Close connections after 2 minutes of inactivity
            heartbeatFrequencyMS: 30000, // Heartbeat every 30 seconds
            retryWrites: true, // Enable retryable writes
            retryReads: true // Enable retryable reads
          });

          // Wait for connection to be established
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('User database connection timeout'));
            }, 30000); // 30 second timeout

            connections.user.once('open', () => {
              clearTimeout(timeout);
              resolve();
            });
            connections.user.once('error', (error) => {
              clearTimeout(timeout);
              console.error(chalk.red('    > user database connection failed:'), error.message);
              reject(error);
            });
          });

          // Add comprehensive event handlers after connection is established
          connections.user.on('error', (error) => {
            console.error(chalk.red('    > user database connection error:'), error.message);
          });

          connections.user.on('disconnected', () => {
            console.log(chalk.yellow('    > user database disconnected'));
          });

          connections.user.on('reconnected', () => {
            console.log(chalk.green('    > user database reconnected'));
          });

          connections.user.on('fullsetup', () => {
            console.log(chalk.blue('    > user database replica set fully connected'));
          });

          connections.user.on('all', () => {
            console.log(chalk.blue('    > user database all servers connected'));
          });

          // Monitor connection pool
          connections.user.on('connectionPoolCreated', () => {
            console.log(chalk.blue('    > user database connection pool created'));
          });

          connections.user.on('connectionPoolClosed', () => {
            console.log(chalk.yellow('    > user database connection pool closed'));
          });

        } catch (error) {
          console.error(chalk.red('    > failed to connect to user database:'), error.message);
          connections.user = null;
        }
      } else {
        console.log(chalk.yellow('    > already connected to user database'));
      }
    }

    // Connect to guild database
    if (connectionStrings.guild) {
      if (!connections.guild) {
        try {
          connections.guild = mongoose.createConnection(connectionStrings.guild, {
            serverSelectionTimeoutMS: 30000, // 30 second timeout
            socketTimeoutMS: 120000, // 2 minute socket timeout
            maxPoolSize: 8, // Maintain up to 8 socket connections
            minPoolSize: 1, // Maintain at least 1 socket connection
            maxIdleTimeMS: 120000, // Close connections after 2 minutes of inactivity
            heartbeatFrequencyMS: 30000, // Heartbeat every 30 seconds
            retryWrites: true, // Enable retryable writes
            retryReads: true // Enable retryable reads
          });

          // Wait for connection to be established
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Guild database connection timeout'));
            }, 30000); // 30 second timeout

            connections.guild.once('open', () => {
              clearTimeout(timeout);
              resolve();
            });
            connections.guild.once('error', (error) => {
              clearTimeout(timeout);
              console.error(chalk.red('    > guild database connection failed:'), error.message);
              reject(error);
            });
          });

          // Add comprehensive event handlers after connection is established
          connections.guild.on('error', (error) => {
            console.error(chalk.red('    > guild database connection error:'), error.message);
          });

          connections.guild.on('disconnected', () => {
            console.log(chalk.yellow('    > guild database disconnected'));
          });

          connections.guild.on('reconnected', () => {
            console.log(chalk.green('    > guild database reconnected'));
          });

          connections.guild.on('fullsetup', () => {
            console.log(chalk.blue('    > guild database replica set fully connected'));
          });

          connections.guild.on('all', () => {
            console.log(chalk.blue('    > guild database all servers connected'));
          });

          // Monitor connection pool
          connections.guild.on('connectionPoolCreated', () => {
            console.log(chalk.blue('    > guild database connection pool created'));
          });

          connections.guild.on('connectionPoolClosed', () => {
            console.log(chalk.yellow('    > guild database connection pool closed'));
          });

        } catch (error) {
          console.error(chalk.red('    > failed to connect to guild database:'), error.message);
          connections.guild = null;
        }
      } else {
        console.log(chalk.yellow('    > already connected to guild database'));
      }
    }

    // Validate that we have at least one connection
    if (!connections.user && !connections.guild) {
      console.log(chalk.red('    > no database connections established'));
      return false;
    }



    return true;
  } catch (error) {
    console.error(chalk.red('    > database connection error:'), error.message);
    return false;
  }
}

/**
 * Disconnect from MongoDB databases with graceful shutdown
 * @param {boolean} force - Force close connections
 * @returns {Promise<void>}
 */
async function disconnect(force = false) {
  try {
    const closeOptions = force ? { force: true } : {};

    if (connections.user) {
      console.log(chalk.blue('    > closing user database connection...'));
      await connections.user.close(closeOptions);
      connections.user = null;
      console.log(chalk.yellow('    > disconnected from user database'));
    }

    if (connections.guild) {
      console.log(chalk.blue('    > closing guild database connection...'));
      await connections.guild.close(closeOptions);
      connections.guild = null;
      console.log(chalk.yellow('    > disconnected from guild database'));
    }
  } catch (error) {
    console.error(chalk.red('    > database disconnection error:'), error.message);
  }
}

/**
 * Check if connected to MongoDB databases
 * @returns {Object} Connection status for each database
 */
function isReady() {
  return {
    user: connections.user ? connections.user.readyState === 1 : false,
    guild: connections.guild ? connections.guild.readyState === 1 : false,
    // Legacy compatibility
    global: connections.user ? connections.user.readyState === 1 : false,
    local: connections.guild ? connections.guild.readyState === 1 : false,
    legacy: connections.guild ? connections.guild.readyState === 1 : false
  };
}

/**
 * Get database connections
 * @returns {Object} Database connections
 */
function getConnections() {
  return connections;
}

/**
 * Health check for database connections
 * @returns {Promise<Object>} Health status
 */
async function healthCheck() {
  const health = {
    user: false,
    guild: false,
    overall: false,
    // Legacy compatibility
    global: false,
    local: false
  };

  try {
    // Check user connection
    if (connections.user && connections.user.readyState === 1) {
      await connections.user.db.admin().ping();
      health.user = true;
      health.global = true; // Legacy compatibility
    }
  } catch (error) {
    console.warn(chalk.yellow('    > user database health check failed:'), error.message);
  }

  try {
    // Check guild connection
    if (connections.guild && connections.guild.readyState === 1) {
      await connections.guild.db.admin().ping();
      health.guild = true;
      health.local = true; // Legacy compatibility
    }
  } catch (error) {
    console.warn(chalk.yellow('    > guild database health check failed:'), error.message);
  }

  health.overall = health.user || health.guild;
  return health;
}

/**
 * Get connection statistics
 * @returns {Object} Connection statistics
 */
function getConnectionStats() {
  const stats = {
    user: null,
    guild: null,
    // Legacy compatibility
    global: null,
    local: null
  };

  if (connections.user) {
    stats.user = {
      readyState: connections.user.readyState,
      name: connections.user.name,
      host: connections.user.host,
      port: connections.user.port,
      collections: Object.keys(connections.user.collections).length
    };
    stats.global = stats.user; // Legacy compatibility
  }

  if (connections.guild) {
    stats.guild = {
      readyState: connections.guild.readyState,
      name: connections.guild.name,
      host: connections.guild.host,
      port: connections.guild.port,
      collections: Object.keys(connections.guild.collections).length
    };
    stats.local = stats.guild; // Legacy compatibility
  }

  return stats;
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown() {
  const gracefulShutdown = async (signal) => {
    console.log(chalk.blue(`\n    > received ${signal}, shutting down gracefully...`));

    try {
      // Close database connections
      await disconnect(false);

      console.log(chalk.green('    > graceful shutdown complete'));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('    > error during graceful shutdown:'), error.message);
      process.exit(1);
    }
  };

  // Handle various shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error(chalk.red('    > uncaught exception:'), error);
    await disconnect(true); // Force close
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error(chalk.red('    > unhandled rejection at:'), promise, 'reason:', reason);
    await disconnect(true); // Force close
    process.exit(1);
  });
}

module.exports = {
  connect,
  disconnect,
  isReady,
  getConnections,
  healthCheck,
  getConnectionStats,
  setupGracefulShutdown
};
