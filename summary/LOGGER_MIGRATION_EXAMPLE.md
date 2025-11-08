# Logger Migration Examples

## Before and After Comparison

### Example 1: Simple Console Logging

**Before:**
```javascript
console.log('Command executed successfully');
console.error('Failed to fetch data:', error);
console.warn('API rate limit approaching');
```

**After:**
```javascript
const logger = require('./utils/logger');

logger.console.log('Command executed successfully');
logger.console.error('Failed to fetch data:', error);
logger.console.warn('API rate limit approaching');
```

---

### Example 2: Error Logger (Old System)

**Before:**
```javascript
const errorLogger = require('./events/dev/errorLogger');

try {
  // command logic
} catch (error) {
  console.error('Error in ban:', error);
  
  if (client.errorLogger) {
    client.errorLogger.log(error, 'Ban Command', {
      user: message.author,
      guild: message.guild,
      command: 'ban',
      args: `${user.tag} - ${reason}`
    });
  }
}
```

**After:**
```javascript
const logger = require('./utils/logger');

try {
  // command logic
} catch (error) {
  // Send to webhook only (production)
  logger.webhook.error(error, 'Ban Command', {
    user: message.author,
    guild: message.guild,
    channel: message.channel,
    command: 'ban',
    args: `${user.tag} - ${reason}`
  });
  
  // OR send to both console and webhook
  logger.both.error(error, 'Ban Command', {
    user: message.author,
    guild: message.guild,
    channel: message.channel,
    command: 'ban',
    args: `${user.tag} - ${reason}`
  });
}
```

---

### Example 3: Sprint Manager

**Before:**
```javascript
console.log(`[Sprint Manager] Found ${activeSprints.length} active sprints to resume`);
console.log(`[Sprint Manager] Scheduled auto-end for sprint ${sprint.messageId}`);
console.error('[Sprint Auto-End] Error:', error);
```

**After:**
```javascript
const logger = require('./utils/logger');

// Development logging (console only)
logger.console.log(`[Sprint Manager] Found ${activeSprints.length} active sprints to resume`);
logger.console.log(`[Sprint Manager] Scheduled auto-end for sprint ${sprint.messageId}`);

// Error that should be tracked (webhook or both)
logger.webhook.error(error, 'Sprint Auto-End', {
  command: 'sprint',
  args: `Sprint ID: ${sprint.messageId}`
});
```

---

### Example 4: Command Processor

**Before:**
```javascript
console.log(`🔍 [PREFIX-PROCESSOR-GET] Getting prefix for guild: "${guildId}"`);
console.error('Error getting guild prefix:', error.message);
```

**After:**
```javascript
const logger = require('./utils/logger');

// Debug logging (console only)
logger.console.debug(`🔍 [PREFIX-PROCESSOR-GET] Getting prefix for guild: "${guildId}"`);

// Error logging (webhook for tracking)
logger.webhook.error(error, 'Prefix Processor', {
  command: 'getGuildPrefix',
  args: `Guild ID: ${guildId}`
});
```

---

### Example 5: Interaction Handler

**Before:**
```javascript
console.warn('Interaction expired, cannot respond:', interaction.customId);
console.error('Error creating ticket:', error);
```

**After:**
```javascript
const logger = require('./utils/logger');

// Warning (console only for development)
logger.console.warn('Interaction expired, cannot respond:', interaction.customId);

// Error (webhook to track production issues)
logger.webhook.error(error, 'Ticket Creation', {
  user: interaction.user,
  guild: interaction.guild,
  channel: interaction.channel,
  command: 'ticket',
  args: `CustomId: ${interaction.customId}`
});
```

---

## Quick Reference

### Choose Your Logging Method:

1. **Development/Debug Info** → `logger.console.log()` or `logger.console.debug()`
2. **Production Errors** → `logger.webhook.error()`
3. **Critical Errors** → `logger.both.error()`
4. **Warnings** → `logger.console.warn()` or `logger.webhook.warn()`
5. **Important Events** → `logger.both.info()`

### Migration Strategy:

1. Add `const logger = require('./utils/logger');` to the top of your file
2. Replace `console.log/error/warn` with `logger.console.log/error/warn`
3. Replace old `errorLogger.log()` with `logger.webhook.error()` or `logger.both.error()`
4. Test to ensure logging works as expected
5. Remove old errorLogger imports if no longer needed

---

## Benefits of New System:

✅ **Centralized** - One import for all logging  
✅ **Flexible** - Choose console, webhook, or both  
✅ **Consistent** - Same format everywhere  
✅ **Safe** - Handles errors gracefully  
✅ **Easy** - Simple API, easy to use  
✅ **Maintainable** - Easy to change logging behavior globally
