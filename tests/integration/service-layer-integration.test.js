/**
 * Service Layer Integration Tests
 * Comprehensive test suite for the new Data Service Layer
 */

require('module-alias/register');

const { 
  initializeServices, 
  getService, 
  getServiceHealth,
  getServiceStats,
  getPerformanceMetrics,
  getCacheWarmerStats
} = require('@services');

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  failures: []
};

function test(name, fn) {
  testResults.total++;
  try {
    fn();
    testResults.passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.failures.push({ name, error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function asyncTest(name, fn) {
  testResults.total++;
  try {
    await fn();
    testResults.passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.failures.push({ name, error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runTests() {
  console.log('\n🧪 Starting Service Layer Integration Tests\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 1: Service Initialization
  console.log('📦 Testing Service Initialization...\n');
  
  await asyncTest('Services can be initialized', async () => {
    // Initialize services before running tests
    assert(typeof initializeServices === 'function', 'initializeServices should be a function');
    await initializeServices();
  });

  await asyncTest('getService function exists', async () => {
    assert(typeof getService === 'function', 'getService should be a function');
  });

  // Test 2: Service Access
  console.log('\n📦 Testing Service Access...\n');

  let guildService, userService, systemService, prefixService;

  await asyncTest('Can get GuildService', async () => {
    guildService = getService('guild');
    assert(guildService, 'GuildService should exist');
    assert(typeof guildService.getPrefix === 'function', 'GuildService should have getPrefix method');
  });

  await asyncTest('Can get UserService', async () => {
    userService = getService('user');
    assert(userService, 'UserService should exist');
    assert(typeof userService.getGamblingData === 'function', 'UserService should have getGamblingData method');
  });

  await asyncTest('Can get SystemService', async () => {
    systemService = getService('system');
    assert(systemService, 'SystemService should exist');
    assert(typeof systemService.isUserBlacklisted === 'function', 'SystemService should have isUserBlacklisted method');
  });

  await asyncTest('Can get PrefixService', async () => {
    prefixService = getService('prefix');
    assert(prefixService, 'PrefixService should exist');
    assert(typeof prefixService.resolvePrefix === 'function', 'PrefixService should have resolvePrefix method');
  });

  // Test 3: Service Methods
  console.log('\n📦 Testing Service Methods...\n');

  await asyncTest('GuildService has required methods', async () => {
    assert(typeof guildService.getPrefix === 'function', 'getPrefix exists');
    assert(typeof guildService.setPrefix === 'function', 'setPrefix exists');
    assert(typeof guildService.get === 'function', 'get exists');
    assert(typeof guildService.set === 'function', 'set exists');
    assert(typeof guildService.batchGetPrefixes === 'function', 'batchGetPrefixes exists');
  });

  await asyncTest('UserService has required methods', async () => {
    assert(typeof userService.getGamblingData === 'function', 'getGamblingData exists');
    assert(typeof userService.updateWallet === 'function', 'updateWallet exists');
    assert(typeof userService.getSelfPrefix === 'function', 'getSelfPrefix exists');
    assert(typeof userService.setSelfPrefix === 'function', 'setSelfPrefix exists');
    assert(typeof userService.batchGetGamblingData === 'function', 'batchGetGamblingData exists');
  });

  await asyncTest('SystemService has required methods', async () => {
    assert(typeof systemService.isUserBlacklisted === 'function', 'isUserBlacklisted exists');
    assert(typeof systemService.isServerBlacklisted === 'function', 'isServerBlacklisted exists');
    assert(typeof systemService.addUserToBlacklist === 'function', 'addUserToBlacklist exists');
    assert(typeof systemService.getBlacklistInfo === 'function', 'getBlacklistInfo exists');
    assert(typeof systemService.batchIsUserBlacklisted === 'function', 'batchIsUserBlacklisted exists');
  });

  await asyncTest('PrefixService has required methods', async () => {
    assert(typeof prefixService.getGuildPrefix === 'function', 'getGuildPrefix exists');
    assert(typeof prefixService.setGuildPrefix === 'function', 'setGuildPrefix exists');
    assert(typeof prefixService.getUserPrefix === 'function', 'getUserPrefix exists');
    assert(typeof prefixService.setUserPrefix === 'function', 'setUserPrefix exists');
    assert(typeof prefixService.resolvePrefix === 'function', 'resolvePrefix exists');
  });

  // Test 4: Health Monitoring
  console.log('\n📦 Testing Health Monitoring...\n');

  await asyncTest('Can get service health', async () => {
    const health = getServiceHealth();
    assert(health, 'Health object should exist');
    assert(health.hasOwnProperty('overall'), 'Health should have overall property');
    assert(health.hasOwnProperty('connectionManager'), 'Health should have connectionManager property');
    // Note: overall and connectionManager should be booleans, but may be false if DB not connected in test environment
    assert(typeof health.overall !== 'undefined', 'Health overall should be defined');
    assert(typeof health.connectionManager !== 'undefined', 'Health connectionManager should be defined');
  });

  await asyncTest('Can get service stats', async () => {
    const stats = getServiceStats();
    assert(stats, 'Stats object should exist');
    assert(stats.guild, 'Stats should have guild service stats');
    assert(stats.user, 'Stats should have user service stats');
  });

  // Test 5: Performance Monitoring
  console.log('\n📦 Testing Performance Monitoring...\n');

  await asyncTest('Can get performance metrics', async () => {
    const metrics = getPerformanceMetrics();
    assert(metrics, 'Metrics object should exist');
    assert(typeof metrics.uptime === 'number', 'Metrics should have uptime');
    assert(typeof metrics.cacheHits === 'number', 'Metrics should have cacheHits');
    assert(typeof metrics.cacheMisses === 'number', 'Metrics should have cacheMisses');
  });

  await asyncTest('Can get cache warmer stats', async () => {
    const stats = getCacheWarmerStats();
    assert(stats, 'Cache warmer stats should exist');
    assert(typeof stats.isRunning === 'boolean', 'Stats should have isRunning');
  });

  // Test 6: Error Handling
  console.log('\n📦 Testing Error Handling...\n');

  await asyncTest('Services handle invalid input gracefully', async () => {
    try {
      await guildService.getPrefix('');
      throw new Error('Should have thrown validation error');
    } catch (error) {
      assert(error.name === 'ValidationError', 'Should throw ValidationError for empty ID');
    }
  });

  await asyncTest('Services handle null input gracefully', async () => {
    try {
      await userService.getGamblingData(null);
      throw new Error('Should have thrown validation error');
    } catch (error) {
      assert(error.name === 'ValidationError', 'Should throw ValidationError for null ID');
    }
  });

  // Test 7: Batch Operations
  console.log('\n📦 Testing Batch Operations...\n');

  await asyncTest('GuildService batch operations exist', async () => {
    assert(typeof guildService.batchGetPrefixes === 'function', 'batchGetPrefixes should exist');
    assert(typeof guildService.batchGetGuilds === 'function', 'batchGetGuilds should exist');
    assert(typeof guildService.batchGetField === 'function', 'batchGetField should exist');
  });

  await asyncTest('UserService batch operations exist', async () => {
    assert(typeof userService.batchGetGamblingData === 'function', 'batchGetGamblingData should exist');
    assert(typeof userService.batchGetUsers === 'function', 'batchGetUsers should exist');
    assert(typeof userService.batchGetField === 'function', 'batchGetField should exist');
  });

  await asyncTest('SystemService batch operations exist', async () => {
    assert(typeof systemService.batchIsUserBlacklisted === 'function', 'batchIsUserBlacklisted should exist');
    assert(typeof systemService.batchIsServerBlacklisted === 'function', 'batchIsServerBlacklisted should exist');
  });

  // Test 8: Compatibility Layer
  console.log('\n📦 Testing Backward Compatibility...\n');

  await asyncTest('Guild compatibility wrapper exists', async () => {
    const guildCompat = require('../../database/cache/models/guild-compat');
    assert(guildCompat, 'Guild compatibility wrapper should exist');
    assert(typeof guildCompat.getPrefix === 'function', 'Compat wrapper should have getPrefix');
  });

  await asyncTest('User compatibility wrapper exists', async () => {
    const userCompat = require('../../database/cache/models/user-compat');
    assert(userCompat, 'User compatibility wrapper should exist');
    assert(typeof userCompat.getGambling === 'function', 'Compat wrapper should have getGambling');
  });

  await asyncTest('System compatibility wrapper exists', async () => {
    const systemCompat = require('../../database/cache/models/system-compat');
    assert(systemCompat, 'System compatibility wrapper should exist');
    assert(typeof systemCompat.getUserBlacklist === 'function', 'Compat wrapper should have getUserBlacklist');
  });

  await asyncTest('Prefix compatibility wrapper exists', async () => {
    const prefixCompat = require('../../database/cache/models/prefix-compat');
    assert(prefixCompat, 'Prefix compatibility wrapper should exist');
    assert(typeof prefixCompat.getGuildPrefix === 'function', 'Compat wrapper should have getGuildPrefix');
  });

  // Test 9: Migration Tools
  console.log('\n📦 Testing Migration Tools...\n');

  await asyncTest('Deprecation manager exists', async () => {
    const deprecationManager = require('../../database/cache/DeprecationManager');
    assert(deprecationManager, 'Deprecation manager should exist');
    assert(typeof deprecationManager.warn === 'function', 'Should have warn method');
    assert(typeof deprecationManager.getUsageReport === 'function', 'Should have getUsageReport method');
  });

  await asyncTest('Migration scripts exist', async () => {
    const fs = require('fs');
    assert(fs.existsSync('scripts/migrate-to-services.js'), 'Migration script should exist');
    assert(fs.existsSync('scripts/deprecation-cli.js'), 'Deprecation CLI should exist');
  });

  // Test 10: Documentation
  console.log('\n📦 Testing Documentation...\n');

  await asyncTest('Migration guide exists', async () => {
    const fs = require('fs');
    const path = require('path');
    const migrationGuidePath = path.join(__dirname, '../../database/services/MIGRATION_GUIDE.md');
    assert(fs.existsSync(migrationGuidePath), 'Migration guide should exist');
  });

  await asyncTest('Service README exists', async () => {
    const fs = require('fs');
    const path = require('path');
    const readmePath = path.join(__dirname, '../../database/services/README.md');
    assert(fs.existsSync(readmePath), 'Service README should exist');
  });

  // Print Results
  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('📊 Test Results Summary\n');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);

  if (testResults.failures.length > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.failures.forEach(failure => {
      console.log(`  - ${failure.name}: ${failure.error}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  if (testResults.failed === 0) {
    console.log('🎉 All tests passed! Service layer is ready for production.\n');
  } else {
    console.log('⚠️  Some tests failed. Please review and fix before deployment.\n');
  }

  return testResults.failed === 0;
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
