# Auto-Context Logger - Simplified Usage ✅

## What Changed

The logger now **automatically extracts context** from Discord message objects, making it much simpler to use!

## Before (Old Way) ❌
```javascript
} catch (error) {
  logger.webhook.error(error, 'Work Command', {
    user: message.author,
    guild: message.guild,
    channel: message.channel,
    command: 'work',
    args: args.join(' ')
  });
}
```

## After (New Way) ✅
```javascript
} catch (error) {
  logger.webhook.error(error, message);
}
```

**That's it!** Just pass the error and the message object. The logger automatically extracts:
- User info
- Guild info
- Channel info
- Command name (from call stack)
- Arguments (from message content)

## How It Works

The logger uses two smart techniques:

1. **Message Object Parsing**: Extracts user, guild, channel from the Discord message
2. **Call Stack Analysis**: Automatically detects which command file called the logger

## Usage Examples

### Webhook Logging
```javascript
const logger = require('./utils/logger');

module.exports = {
  name: "mycommand",
  run: async (client, message, args) => {
    try {
      // Your command logic
    } catch (error) {
      logger.webhook.error(error, message);  // Auto-extracts everything!
      return embeds.deny(message, 'An error occurred');
    }
  }
};
```

### Console + Webhook (Both)
```javascript
} catch (error) {
  logger.both.error(error, message);  // Logs to both console and webhook
}
```

### Console Only
```javascript
logger.console.log('Debug info');
logger.console.error('Dev error');
```

## What Gets Logged

When you call `logger.webhook.error(error, message)`, the webhook receives:

```
**New error detected**

**cmd used**
```
mycommand arg1 arg2
```

**Traceback error**
```
Error: Something went wrong
    at Object.run (/path/to/command.js:42:15)
    ...
```

**Author**: User#1234 (with avatar)
**Footer**: Server ID - 123456 | Channel ID - 789012
```

## Benefits

✅ **90% less code** - No more typing out all the context  
✅ **Consistent** - Same format everywhere  
✅ **Automatic** - Command name detected from call stack  
✅ **Simple** - Just pass error and message  
✅ **Smart** - Handles missing message gracefully

## Migration

All gamble and moderation commands have been updated to use the new syntax!

### Files Updated
- ✅ All gamble commands (20+ files)
- ✅ All moderation commands (10 files)
- ✅ Dev commands (blacklist)

### Still Using Old Syntax
- Server commands (will be updated next)
- Information commands (will be updated next)
- Other categories

## Backward Compatibility

The old syntax still works if you need it:
```javascript
logger.webhook.error(error, null);  // No message object, uses call stack only
```

## Testing

Test any command with an error to see the webhook logging in action:
```
,work  // Should log to webhook if error occurs
,bal   // Should log to webhook if error occurs
```

---

**Result**: Much cleaner code, same functionality! 🎉
