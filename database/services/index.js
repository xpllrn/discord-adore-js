/**
 * Services Index
 * Provides centralized access to all data services
 */

// Data services (match collections)
const GuildService = require('./data/GuildService');
const UserService = require('./data/UserService');
const SystemService = require('./data/SystemService');

// Feature services
const PrefixService = require('./features/PrefixService');
const SpotifyService = require('./features/SpotifyService');

// Core infrastructure
const BaseService = require('./core/BaseService');
const SmartCache = require('./core/SmartCache');
const { ConnectionManager, getConnectionManager } = require('./core/connection');
const cacheWarmer = require('./core/CacheWarmer');
const performanceMonitor = require('./core/PerformanceMonitor');
const {
  ServiceError,
  DatabaseConnectionError,
  ValidationError,
  CacheError,
  DatabaseWriteError,
  NotFoundError,
  ErrorHandler
} = require('./core/errors');

// Service instances (singletons)
let serviceInstances = {
  guild: null,
  user: null,
  prefix: null,
  spotify: null,
  system: null,
  connectionManager: null
};

/**
 * Initialize all services
 * @param {Object} config - Service configuration
 * @returns {Promise<boolean>} Success status
 */
async function initializeServices(config = {}) {
  try {
    // Get existing connection manager (should already be initialized by database/index.js)
    serviceInstances.connectionManager = getConnectionManager();

    // Initialize data services
    serviceInstances.guild = new GuildService();
    serviceInstances.user = new UserService();
    serviceInstances.system = new SystemService();
    
    // Initialize feature services
    serviceInstances.spotify = new SpotifyService();
    serviceInstances.prefix = new PrefixService(serviceInstances.guild, serviceInstances.user);

    // Start cache warmer for system-wide data (after startup delay)
    cacheWarmer.start(serviceInstances);

    return true;

  } catch (error) {
    console.error('Failed to initialize Data Service Layer:', error.message);
    throw error;
  }
}

/**
 * Get service instance by name
 * @param {string} serviceName - Name of the service
 * @returns {Object} Service instance
 */
function getService(serviceName) {
  const service = serviceInstances[serviceName];
  if (!service) {
    throw new Error(`Service '${serviceName}' not initialized or not found`);
  }
  return service;
}

/**
 * Get connection manager instance
 * @returns {ConnectionManager} Connection manager
 */
function getConnectionManagerInstance() {
  return serviceInstances.connectionManager || getConnectionManager();
}

/**
 * Shutdown all services
 * @returns {Promise<void>}
 */
async function shutdownServices() {
  console.log('Shutting down Data Service Layer...');

  const shutdownPromises = [];

  // Shutdown individual services
  for (const [name, service] of Object.entries(serviceInstances)) {
    if (service && typeof service.shutdown === 'function') {
      shutdownPromises.push(
        service.shutdown().catch(error => {
          console.error(`Error shutting down ${name} service:`, error.message);
        })
      );
    }
  }

  await Promise.all(shutdownPromises);

  // Clear service instances
  serviceInstances = {};

  console.log('Data Service Layer shutdown complete');
}

/**
 * Get service health status
 * @returns {Object} Health status of all services
 */
function getServiceHealth() {
  const health = {
    connectionManager: false,
    overall: false
  };

  // Check connection manager
  if (serviceInstances.connectionManager) {
    try {
      const connectionStatus = serviceInstances.connectionManager.isReady();
      health.connectionManager = connectionStatus?.overall || false;
    } catch (error) {
      console.error('Error checking connection manager health:', error.message);
      health.connectionManager = false;
    }
  }

  // Check service health
  health.guild = serviceInstances.guild?.initialized || false;
  health.user = serviceInstances.user?.initialized || false;
  health.prefix = serviceInstances.prefix?.initialized || false;
  health.spotify = serviceInstances.spotify?.initialized || false;
  health.system = serviceInstances.system?.initialized || false;

  // Overall health is true if core services are healthy (connection manager is optional)
  health.overall = health.guild && health.user && health.prefix && health.system;

  return health;
}

/**
 * Get service statistics
 * @returns {Object} Statistics from all services
 */
function getServiceStats() {
  const stats = {
    connectionManager: null,
    timestamp: new Date()
  };

  // Get connection manager stats
  if (serviceInstances.connectionManager) {
    stats.connectionManager = serviceInstances.connectionManager.getConnectionStats();
  }

  // Get service stats
  if (serviceInstances.guild) {
    stats.guild = serviceInstances.guild.getGuildStats();
  }
  
  if (serviceInstances.user) {
    stats.user = serviceInstances.user.getUserStats();
  }
  
  if (serviceInstances.prefix) {
    stats.prefix = serviceInstances.prefix.getStats();
  }

  return stats;
}

module.exports = {
  // Initialization
  initializeServices,
  shutdownServices,
  
  // Service access
  getService,
  getConnectionManagerInstance,
  
  // Health and monitoring
  getServiceHealth,
  getServiceStats,
  
  // Core classes (for direct instantiation if needed)
  BaseService,
  SmartCache,
  ConnectionManager,
  cacheWarmer,
  performanceMonitor,
  
  // Error classes
  ServiceError,
  DatabaseConnectionError,
  ValidationError,
  CacheError,
  DatabaseWriteError,
  NotFoundError,
  ErrorHandler,
  
  // Service classes
  GuildService,
  UserService,
  SystemService,
  PrefixService,
  SpotifyService
};
