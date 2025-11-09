# Summary Documentation

Quick reference for key architectural decisions and patterns in this codebase.

## Files

### [architecture.md](./architecture.md)
Service layer structure, cache system, connection management, and usage patterns.

### [cache-system.md](./cache-system.md)
Write-through caching strategy, configuration, best practices, and performance metrics.

### [logger-system.md](./logger-system.md)
Auto-context error logging with webhook integration. All commands use this pattern.

### [help-system.md](./help-system.md)
Consistent help display using `runHelpCommand()` instead of inline usage strings.

### [utils-structure.md](./utils-structure.md)
Utils folder organization: helpers, embeds, logger, and command processor.

### [background-tasks.md](./background-tasks.md)
Periodic tasks: reminders, giveaways, and sprint management.

## Quick Reference

**Get a service**:
```javascript
const { getService } = require('@services');
const userService = getService('user');
```

**Error handling**:
```javascript
catch (error) {
  logger.webhook.error(error, message);
}
```

**Show help**:
```javascript
return runHelpCommand(client, message, commandName);
```

**Cache operations**:
```javascript
const data = await service.get(key);      // Read (cache-first)
await service.set(key, data);             // Write (write-through)
await service.delete(key);                // Delete
```
