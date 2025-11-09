# Logger System

## Auto-Context Error Logging

### Usage
```javascript
const logger = require('../../utils/logger');

try {
  // Command logic
} catch (error) {
  logger.webhook.error(error, message);
}
```

### What It Does Automatically
1. Extracts user info from `message.author`
2. Extracts guild info from `message.guild`
3. Extracts channel info from `message.channel`
4. Detects command name from call stack
5. Parses arguments from `message.content`

### Webhook Format
```
**New error detected**

**cmd used**
```
commandname arg1 arg2
```

**Traceback error**
```
Error: Something went wrong
    at commands/category/command.js:95:10
```

**Author**: Username (ID: 123456)
**Footer**: Server ID - 789012 | Channel ID - 345678
```

## Status

✅ All 100+ commands converted
✅ ~1,477 lines of code removed
✅ Consistent logging across entire codebase
