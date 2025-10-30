const mongoose = require('mongoose');
const chalk = require('chalk');

// Connection states
let connections = {
  global: null,  // Global user database connection
  local: null    // Local guild database connection
};

/**
 * Connect to multiple MongoDB databases
 * @param {Object} connectionStrings - Object containing connection strings
 * @param {string} connectionStrings.global - Global user database connection string
 * @param {string} connectionStrings.local - Local guild database connection string
 * @returns {Promise<boolean>} Connection success status
 */
async function connect(connectionStrings) {
  try {
    // Configure mongoose
    mongoose.set('strictQuery', false);

    // Connect to global user database
    if (connectionStrings.global) {
      if (!connections.global) {
        try {
          connections.global = mongoose.createConnection(connectionStrings.global, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 15000, // 15 second timeout (increased)
            socketTimeoutMS: 60000, // 60 second socket timeout (increased)
            maxPoolSize: 20, // Maintain up to 20 socket connections (increased)
            minPoolSize: 5, // Maintain at least 5 socket connections
            maxIdleTimeMS: 60000, // Close connections after 60 seconds of inactivity (increased)
            maxConnecting: 5, // Maximum number of connections being established at once
            heartbeatFrequencyMS: 10000, // Heartbeat every 10 seconds
            retryWrites: true, // Enable retryable writes
            retryReads: true, // Enable retryable reads
            readPreference: 'primaryPreferred', // Read from primary, fallback to secondary
            writeConcern: { w: 'majority', j: true }, // Ensure writes are acknowledged by majority
            bufferCommands: true, // Enable mongoose buffering to handle connection delays
          });

          // Wait for connection to be established
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Global database connection timeout'));
            }, 15000); // 15 second timeout

            connections.global.once('open', () => {
              clearTimeout(timeout);
              resolve();
            });
            connections.global.once('error', (error) => {
              clearTimeout(timeout);
              console.error(chalk.red('    > global database connection failed:'), error.message);
              reject(error);
            });
          });

          // Add comprehensive event handlers after connection is established
          connections.global.on('error', (error) => {
            console.error(chalk.red('    > global database connection error:'), error.message);
          });

          connections.global.on('disconnected', () => {
            console.log(chalk.yellow('    > global database disconnected'));
          });

          connections.global.on('reconnected', () => {
            console.log(chalk.green('    > global database reconnected'));
          });

          connections.global.on('fullsetup', () => {
            console.log(chalk.blue('    > global database replica set fully connected'));
          });

          connections.global.on('all', () => {
            console.log(chalk.blue('    > global database all servers connected'));
          });

          // Monitor connection pool
          connections.global.on('connectionPoolCreated', () => {
            console.log(chalk.blue('    > global database connection pool created'));
          });

          connections.global.on('connectionPoolClosed', () => {
            console.log(chalk.yellow('    > global database connection pool closed'));
          });

        } catch (error) {
          console.error(chalk.red('    > failed to connect to global database:'), error.message);
          connections.global = null;
        }
      } else {
        console.log(chalk.yellow('    > already connected to global user database'));
      }
    }

    // Connect to local guild database
    if (connectionStrings.local) {
      if (!connections.local) {
        try {
          connections.local = mongoose.createConnection(connectionStrings.local, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 15000, // 15 second timeout (increased)
            socketTimeoutMS: 60000, // 60 second socket timeout (increased)
            maxPoolSize: 15, // Maintain up to 15 socket connections (increased)
            minPoolSize: 3, // Maintain at least 3 socket connections
            maxIdleTimeMS: 60000, // Close connections after 60 seconds of inactivity (increased)
            maxConnecting: 3, // Maximum number of connections being established at once
            heartbeatFrequencyMS: 10000, // Heartbeat every 10 seconds
            retryWrites: true, // Enable retryable writes
            retryReads: true, // Enable retryable reads
            readPreference: 'primaryPreferred', // Read from primary, fallback to secondary
            writeConcern: { w: 'majority', j: true }, // Ensure writes are acknowledged by majority
            bufferCommands: true, // Enable mongoose buffering to handle connection delays
          });

          // Wait for connection to be established
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Local database connection timeout'));
            }, 15000); // 15 second timeout

            connections.local.once('open', () => {
              clearTimeout(timeout);
              resolve();
            });
            connections.local.once('error', (error) => {
              clearTimeout(timeout);
              console.error(chalk.red('    > local database connection failed:'), error.message);
              reject(error);
            });
          });

          // Add comprehensive event handlers after connection is established
          connections.local.on('error', (error) => {
            console.error(chalk.red('    > local database connection error:'), error.message);
          });

          connections.local.on('disconnected', () => {
            console.log(chalk.yellow('    > local database disconnected'));
          });

          connections.local.on('reconnected', () => {
            console.log(chalk.green('    > local database reconnected'));
          });

          connections.local.on('fullsetup', () => {
            console.log(chalk.blue('    > local database replica set fully connected'));
          });

          connections.local.on('all', () => {
            console.log(chalk.blue('    > local database all servers connected'));
          });

          // Monitor connection pool
          connections.local.on('connectionPoolCreated', () => {
            console.log(chalk.blue('    > local database connection pool created'));
          });

          connections.local.on('connectionPoolClosed', () => {
            console.log(chalk.yellow('    > local database connection pool closed'));
          });

        } catch (error) {
          console.error(chalk.red('    > failed to connect to local database:'), error.message);
          connections.local = null;
        }
      } else {
        console.log(chalk.yellow('    > already connected to local guild database'));
      }
    }

    // Validate that we have at least one connection
    if (!connections.global && !connections.local) {
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

    if (connections.global) {
      console.log(chalk.blue('    > closing global database connection...'));
      await connections.global.close(closeOptions);
      connections.global = null;
      console.log(chalk.yellow('    > disconnected from global user database'));
    }

    if (connections.local) {
      console.log(chalk.blue('    > closing local database connection...'));
      await connections.local.close(closeOptions);
      connections.local = null;
      console.log(chalk.yellow('    > disconnected from local guild database'));
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
    global: connections.global ? connections.global.readyState === 1 : false,
    local: connections.local ? connections.local.readyState === 1 : false,
    legacy: connections.local ? connections.local.readyState === 1 : false // For backward compatibility
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
    global: false,
    local: false,
    overall: false
  };

  try {
    // Check global connection
    if (connections.global && connections.global.readyState === 1) {
      await connections.global.db.admin().ping();
      health.global = true;
    }
  } catch (error) {
    console.warn(chalk.yellow('    > global database health check failed:'), error.message);
  }

  try {
    // Check local connection
    if (connections.local && connections.local.readyState === 1) {
      await connections.local.db.admin().ping();
      health.local = true;
    }
  } catch (error) {
    console.warn(chalk.yellow('    > local database health check failed:'), error.message);
  }

  health.overall = health.global || health.local;
  return health;
}

/**
 * Get connection statistics
 * @returns {Object} Connection statistics
 */
function getConnectionStats() {
  const stats = {
    global: null,
    local: null
  };

  if (connections.global) {
    stats.global = {
      readyState: connections.global.readyState,
      name: connections.global.name,
      host: connections.global.host,
      port: connections.global.port,
      collections: Object.keys(connections.global.collections).length
    };
  }

  if (connections.local) {
    stats.local = {
      readyState: connections.local.readyState,
      name: connections.local.name,
      host: connections.local.host,
      port: connections.local.port,
      collections: Object.keys(connections.local.collections).length
    };
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
