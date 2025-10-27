/**
 * Services Index
 * Provides centralized access to all data services
 */

// Core services
const GuildService = require('./GuildService');
const UserService = require('./UserService');
const PrefixService = require('./PrefixService');
const SpotifyService = require('./SpotifyService');
const ModerationService = require('./ModerationService');
// const SystemService = require('./SystemService'); // Will be implemented in subsequent tasks

// Core infrastructure
const BaseService = require('./core/BaseService');
const SmartCache = require('./core/SmartCache');
const { ConnectionManager, getConnectionManager } = require('./core/ConnectionManager');
const RetryManager = require('./core/RetryManager');
const cacheWarmer = require('./core/CacheWarmer');
const performanceMonitor = require('./core/PerformanceMonitor');
const {
  ServiceError,
  DatabaseConnectionError,
  ValidationError,
  CacheError,
  DatabaseWriteError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ErrorHandler
} = require('./core/errors');

// Service instances (singletons)
let serviceInstances = {
  guild: null,
  user: null,
  prefix: null,
  spotify: null,
  moderation: null,
  // system: null,
  connectionManager: null
};

/**
 * Initialize all services
 * @param {Object} config - Service configuration
 * @returns {Promise<boolean>} Success status
 */
async function initializeServices(config = {}) {
  try {
    console.log('🚀 Initializing Data Service Layer...');

    // Initialize connection manager
    serviceInstances.connectionManager = getConnectionManager();
    
    if (config.connectionStrings) {
      await serviceInstances.connectionManager.initialize(config.connectionStrings);
    }

    // Initialize services
    serviceInstances.guild = new GuildService();
    serviceInstances.user = new UserService();
    serviceInstances.spotify = new SpotifyService();
    serviceInstances.moderation = new ModerationService();
    const SystemService = require('./SystemService');
    serviceInstances.system = new SystemService();
    serviceInstances.prefix = new PrefixService(serviceInstances.guild, serviceInstances.user);

    // Start cache warmer for system-wide data (after startup delay)
    cacheWarmer.start(serviceInstances);

    console.log('✅ Data Service Layer initialized successfully');
    return true;

  } catch (error) {
    console.error('❌ Failed to initialize Data Service Layer:', error.message);
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
  console.log('🔄 Shutting down Data Service Layer...');

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

  console.log('✅ Data Service Layer shutdown complete');
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
    const connectionStatus = serviceInstances.connectionManager.isReady();
    health.connectionManager = connectionStatus.overall;
  }

  // Check service health
  health.guild = serviceInstances.guild?.initialized || false;
  health.user = serviceInstances.user?.initialized || false;
  health.prefix = serviceInstances.prefix?.initialized || false;
  health.spotify = serviceInstances.spotify?.initialized || false;
  health.moderation = serviceInstances.moderation?.initialized || false;
  health.system = serviceInstances.system?.initialized || false;

  // Overall health is true if connection manager and core services are healthy
  health.overall = health.connectionManager && health.guild && health.user && health.prefix && health.system;

  return health;
}

/**
 * Get service statistics
 * @returns {Object} Statistics from all services
 */
function getServiceStats() {
  const stats = {
    connectionManager: null,
    // guild: null,
    // user: null,
    // system: null,
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
  
  // TODO: Get other service stats when implemented

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
  getCacheWarmerStats: () => cacheWarmer.getStats(),
  manualCacheWarm: () => cacheWarmer.manualWarm(serviceInstances),
  getPerformanceMetrics: () => performanceMonitor.getMetrics(),
  getPerformanceSummary: () => performanceMonitor.getSummary(),
  printPerformanceReport: () => performanceMonitor.printReport(),
  resetPerformanceMetrics: () => performanceMonitor.reset(),
  
  // Core classes (for direct instantiation if needed)
  BaseService,
  SmartCache,
  ConnectionManager,
  RetryManager,
  cacheWarmer,
  performanceMonitor,
  
  // Error classes
  ServiceError,
  DatabaseConnectionError,
  ValidationError,
  CacheError,
  DatabaseWriteError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ErrorHandler,
  
  // Service classes
  GuildService,
  UserService,
  PrefixService,
  SpotifyService,
  ModerationService
};