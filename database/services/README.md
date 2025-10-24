# Data Service Layer

Modern, efficient service layer for database operations with smart caching and error handling.

## Overview

The Data Service Layer replaces the old cache model system with a more robust, maintainable architecture:

- **Smart Caching**: LRU cache with TTL management
- **Write-Through Strategy**: Database-first writes with cache updates
- **Automatic Retries**: Transient error handling with exponential backoff
- **Validation**: Input validation for all operations
- **Error Handling**: Comprehensive error types and user-friendly messages

## Quick Start

```javascript
const { getService, initializeServices } = require('@services');

// Initialize services (do this once at startup)
await initializeServices();

// Get service instances
const guildService = getService('guild');
const userService = getService('user');
const systemService = getService('system');
const prefixService = getService('prefix');

// Use services
const prefix = await guildService.getPrefix(guildId);
const gambling = await userService.getGamblingData(userId);
const isBlacklisted = await systemService.isUserBlacklisted(userId);
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  (Commands, Events, Utils)              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Service Layer                   │
│  ┌──────────┐  ┌──────────┐            │
│  │  Guild   │  │   User   │            │
│  │ Service  │  │ Service  │            │
│  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐            │
│  │ System   │  │  Prefix  │            │
│  │ Service  │  │ Service  │            │
│  └──────────┘  └──────────┘            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Core Components                 │
│  ┌──────────────┐  ┌──────────────┐    │
│  │  SmartCache  │  │ RetryManager │    │
│  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐  ┌──────────────┐    │
│  │ ErrorHandler │  │ Connection   │    │
│  │              │  │   Manager    │    │
│  └──────────────┘  └──────────────┘    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Database Layer                  │
│         (MongoDB Models)                │
└─────────────────────────────────────────┘
```

## Services

### GuildService

Manages guild-specific data including prefixes, settings, and features.

```javascript
const guildService = getService('guild');

// Prefix operations
await guildService.getPrefix(guildId);
await guildService.setPrefix(guildId, prefix);

// Field operations
await guildService.getField(guildId, 'WelcomeChannel');
await guildService.setField(guildId, 'WelcomeChannel', channelId);

// Full guild data
await guildService.getGuild(guildId);
await guildService.setGuild(guildId, data);
```

**Cache Configuration:**
- TTL: 30 minutes
- Max Size: 1000 guilds
- Strategy: Write-through

### UserService

Manages user data including gambling, preferences, and notes.

```javascript
const userService = getService('user');

// Gambling operations
await userService.getGamblingData(userId);
await userService.setGamblingData(userId, gambling);
await userService.addMoney(userId, amount, 'wallet');
await userService.removeMoney(userId, amount, 'bank');

// Prefix operations
await userService.getUserPrefix(userId);
await userService.setUserPrefix(userId, prefix);

// Field operations
await userService.getField(userId, 'Notes');
await userService.setField(userId, 'Notes', notes);

// Full user data
await userService.getUser(userId);
await userService.setUser(userId, data);
```

**Cache Configuration:**
- TTL: 30 minutes
- Max Size: 5000 users
- Strategy: Write-through

### SystemService

Manages system-wide data including blacklists and global settings.

```javascript
const systemService = getService('system');

// Blacklist operations
await systemService.isUserBlacklisted(userId);
await systemService.isServerBlacklisted(serverId);
await systemService.addUserToBlacklist(userId, reason, addedBy);
await systemService.removeUserFromBlacklist(userId);
await systemService.getBlacklistInfo();

// Global settings
await systemService.getGlobalSetting('maintenanceMode');
await systemService.setGlobalSetting('maintenanceMode', true);
await systemService.getAllGlobalSettings();

// System status
await systemService.getSystemStatus();
await systemService.updateSystemStatus({ uptime: 12345 });

// Maintenance mode
await systemService.isMaintenanceModeEnabled();
await systemService.enableMaintenanceMode(reason, adminId);
await systemService.disableMaintenanceMode();
```

**Cache Configuration:**
- TTL: 2 hours (longer for system data)
- Max Size: 100 entries
- Strategy: Write-through

### PrefixService

Orchestrates prefix resolution with proper priority (user → guild → mention).

```javascript
const prefixService = getService('prefix');

// Unified prefix resolution
const result = await prefixService.resolvePrefix(message);
// Returns: { prefix, content, type } or null

// Guild prefix
await prefixService.getGuildPrefix(guildId);
await prefixService.setGuildPrefix(guildId, prefix);

// User prefix
await prefixService.getUserPrefix(userId);
await prefixService.setUserPrefix(userId, prefix);
await prefixService.clearUserPrefix(userId);
```

**Features:**
- Proper priority: user prefix → guild prefix → mention
- Efficient caching through underlying services
- Consistent prefix resolution across the bot

## Error Handling

### Error Types

```javascript
const {
  ValidationError,
  DatabaseConnectionError,
  DatabaseWriteError,
  NotFoundError,
  CacheError,
  PermissionError,
  RateLimitError
} = require('@services/core/errors');
```

### Handling Errors

```javascript
try {
  await guildService.setPrefix(guildId, prefix);
} catch (error) {
  if (error instanceof ValidationError) {
    // Invalid input
    return message.reply('Invalid prefix format');
  }
  
  if (error instanceof DatabaseConnectionError) {
    // Temporary database issue
    return message.reply('Database temporarily unavailable');
  }
  
  // Other errors
  console.error('Unexpected error:', error);
}
```

### User-Friendly Messages

```javascript
const { ErrorHandler } = require('@services/core/errors');

try {
  await guildService.setPrefix(guildId, prefix);
} catch (error) {
  const userMessage = ErrorHandler.handleServiceError(
    error,
    'setting prefix',
    { guildId, prefix }
  );
  return message.reply(userMessage);
}
```

## Caching Strategy

### Write-Through Caching

1. **Write**: Data is written to database first
2. **Update**: Cache is updated after successful write
3. **Invalidate**: Cache is cleared on write failure

### Read Strategy

1. **Check Cache**: Look for data in cache first
2. **Cache Hit**: Return cached data immediately
3. **Cache Miss**: Fetch from database, cache result, return

### Cache Invalidation

- **TTL-based**: Automatic expiration after configured time
- **LRU eviction**: Least recently used items removed when cache is full
- **Manual**: Cache cleared on write failures

## Performance

### Benchmarks

- **Cache Hit**: < 1ms
- **Cache Miss**: 10-50ms (database query)
- **Write Operation**: 20-100ms (database + cache update)

### Optimization Tips

1. **Batch Operations**: Use Promise.all for multiple reads
2. **Cache Warming**: Preload frequently accessed data
3. **Field Access**: Use getField/setField for partial updates
4. **Avoid Overwrites**: Update specific fields instead of full documents

## Health Monitoring

```javascript
const { getServiceHealth, getServiceStats } = require('@services');

// Check service health
const health = getServiceHealth();
console.log('Services healthy:', health.overall);
console.log('Guild service:', health.guild);
console.log('User service:', health.user);

// Get service statistics
const stats = getServiceStats();
console.log('Cache stats:', stats.guild.cacheStats);
console.log('Service info:', stats.user);
```

## Migration

See [Migration Guide](../../../.kiro/specs/database-cache-restructure/migration-guide.md) for detailed instructions on migrating from old cache models.

### Quick Migration

```bash
# Check deprecation status
node scripts/deprecation-cli.js status

# Auto-migrate a file
node scripts/migrate-to-services.js commands/essentials/prefix.js

# View usage report
node scripts/deprecation-cli.js report
```

## Best Practices

### 1. Always Initialize Services

```javascript
// In your main bot file
const { initializeServices } = require('@services');
await initializeServices();
```

### 2. Use Error Handling

```javascript
try {
  const result = await service.operation();
} catch (error) {
  // Handle error appropriately
}
```

### 3. Validate Input

Services validate automatically, but pre-validation can improve UX:

```javascript
if (!guildId || guildId.length === 0) {
  return message.reply('Invalid guild ID');
}
const prefix = await guildService.getPrefix(guildId);
```

### 4. Use Appropriate Service

- Guild data → GuildService
- User data → UserService
- System data → SystemService
- Prefix operations → PrefixService

### 5. Leverage Caching

```javascript
// Good: Single call, cached result
const prefix = await guildService.getPrefix(guildId);

// Avoid: Multiple calls for same data
const prefix1 = await guildService.getPrefix(guildId);
const prefix2 = await guildService.getPrefix(guildId); // Uses cache
```

## Troubleshooting

### Services Not Initialized

**Error**: "Service not initialized"

**Solution**: Call `initializeServices()` before using services

### Database Connection Issues

**Error**: "DatabaseConnectionError"

**Solution**: Check database connection, services will retry automatically

### Validation Errors

**Error**: "ValidationError"

**Solution**: Check error.field and error.value for details

### Cache Issues

**Error**: "CacheError"

**Solution**: Services will fall back to database, check logs

## API Reference

See individual service files for complete API documentation:

- [BaseService](./core/BaseService.js)
- [GuildService](./GuildService.js)
- [UserService](./UserService.js)
- [SystemService](./SystemService.js)
- [PrefixService](./PrefixService.js)

## Support

- Migration Guide: `.kiro/specs/database-cache-restructure/migration-guide.md`
- Design Document: `.kiro/specs/database-cache-restructure/design.md`
- Deprecation CLI: `node scripts/deprecation-cli.js help`
