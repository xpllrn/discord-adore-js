# Logger Usage Guide

The unified logger provides three ways to log: console only, webhook only, or both.

## Import

```javascript
const logger = require('./utils/logger');
```

## Usage Examples

### Console Only (Development/Debug)

```javascript
// Regular logging
logger.console.log('Bot started successfully');
logger.console.info('Processing command...');
logger.console.warn('Cache not ready');
logger.console.error('Failed to connect to database');
logger.console.debug('Debug info:', someVariable);
```

### Webhook Only (Production Errors)

```javascript
// Error logging to Discord webhook
logger.webhook.error(
  error,                    // Error object or string
  'Command Execution',      // Context
  {
    user: message.author,   // Optional: user object
    guild: message.guild,   // Optional: guild object
    channel: message.channel, // Optional: channel object
    command: 'ban',         // Optional: command name
    args: '@user spam'      // Optional: command arguments
  }
);

// Warning to webhook
logger.webhook.warn(
  'API rate limit approaching',
  'Spotify API',
  { command: 'nowplaying' }
);

// Info to webhook
logger.webhook.info(
  'Premium feature accessed',
  'Premium System',
  { user: message.author, guild: message.guild }
);
```

### Both Console and Webhook

```javascript
// Log to both console and webhook
logger.both.error(
  error,
  'Critical Error',
  {
    user: message.author,
    guild: message.guild,
    command: 'setup',
    args: 'welcome #channel'
  }
);

logger.both.warn('Database connection unstable', 'Database');
logger.both.info('Bot restarted', 'System');
```

## Migration Examples

### Before (Old Way)

```javascript
// Scattered console logs
console.log('Command executed');
console.error('Error:', error);

// Old error logger
const errorLogger = require('./events/dev/errorLogger');
errorLogger.log(error, 'Command', { user, guild, command });
```

### After (New Way)

```javascript
const logger = require('./utils/logger');

// Choose what you need
logger.console.log('Command executed');
logger.webhook.error(error, 'Command', { user, guild, command });

// Or use both
logger.both.error(error, 'Command', { user, guild, command });
```

## When to Use What

- **console.log/info/debug**: Development, debugging, non-critical info
- **console.warn**: Warnings that don't need webhook notification
- **console.error**: Errors during development

- **webhook.error**: Production errors that need attention
- **webhook.warn**: Important warnings in production
- **webhook.info**: Important events to track

- **both.error**: Critical errors that need immediate attention
- **both.warn**: Important warnings to track everywhere
- **both.info**: Important events to log everywhere

## Benefits

1. **Centralized**: All logging goes through one system
2. **Flexible**: Choose console, webhook, or both
3. **Consistent**: Same format everywhere
4. **Safe**: Handles broken pipes and webhook failures gracefully
5. **Easy Migration**: Replace existing logs gradually
