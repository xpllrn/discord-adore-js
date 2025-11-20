# Bot Documentation

Complete technical documentation for the Discord bot's architecture, systems, and utilities.

---

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Database & Services](#database--services)
3. [Cache System](#cache-system)
4. [Background Tasks](#background-tasks)
5. [Logger System](#logger-system)
6. [Help System](#help-system)
7. [Utils Structure](#utils-structure)
8. [Data Loss Prevention](#data-loss-prevention)

---

## Project Architecture

### Service Layer Structure

```
database/services/
├── core/                    # Infrastructure
│   ├── BaseService.js       # Base class for all services
│   ├── SmartCache.js        # LRU cache with TTL
│   ├── connection.js        # MongoDB connection with retry & health monitoring
│   ├── CacheWarmer.js       # Preload frequently accessed data
│   ├── PerformanceMonitor.js# Performance tracking
│   └── errors.js            # Custom error classes
│
├── data/                    # Data services (1:1 with collections)
│   ├── GuildService.js      # Guild collection operations
│   ├── UserService.js       # User collection operations
│   └── SystemService.js     # System collection operations
│
└── features/                # Feature services (combine data services)
    ├── PrefixService.js     # Prefix management (Guild + User)
    └── SpotifyService.js    # Spotify integration (User + API)
```

### Usage Pattern

```javascript
const { getService } = require('@services');

// Get services
const userService = getService('user');
const guildService = getService('guild');

// Read (cache-first)
const userData = await userService.get(userId);

// Write (write-through)
await userService.set(userId, updatedData);

// Delete
await userService.delete(userId);
```

---

## Database & Services

### Connection System

**Features**:
- Automatic retry (3 attempts: 2s, 5s, 10s delays)
- Health monitoring (every 60 seconds)
- Connection statistics tracking
- Graceful shutdown handling

### Service Layer Benefits

- **Abstraction**: Commands don't touch MongoDB directly
- **Caching**: Automatic cache management
- **Consistency**: All data access follows same pattern
- **Monitoring**: Built-in performance tracking

---

## Cache System

### Write-Through Caching Strategy

**Write Flow**:
```javascript
async set(key, data) {
  // 1. Write to database FIRST
  await this.writeToDatabase(key, data);
  
  // 2. Update cache AFTER successful write
  this.cache.set(key, data);
}
```

**Read Flow**:
```javascript
async get(key) {
  // 1. Check cache first
  const cached = this.cache.get(key);
  if (cached !== null) return cached;
  
  // 2. Cache miss - fetch from database
  const data = await this.readFromDatabase(key);
  
  // 3. Cache the result
  if (data !== null) this.cache.set(key, data);
  
  return data;
}
```

### Configuration

**UserService**:
- TTL: 45 minutes
- Max Size: 10,000 users
- LRU eviction when full

**GuildService**:
- TTL: 60 minutes
- Max Size: 5,000 guilds

### Best Practices

✅ **DO**:
- Always use `this.set()` for writes
- Always use `this.get()` for reads
- Use `ensureUserData()` to guarantee user exists

❌ **DON'T**:
- Don't bypass cache with direct MongoDB operations
- Don't modify cached objects without calling `this.set()`
- If you must bypass, call `this.invalidateCache(key)`

### Performance

**Expected Hit Rates**:
- Active users: 95%+ hit rate
- Overall: 80-90% hit rate

**Memory Usage**:
- ~2-5 KB per user
- 10,000 users = ~20-50 MB

---

## Background Tasks

**Location**: `events/system/backgroundTasks.js`

### Tasks

#### 1. Reminder Checking (Every Minute)
- Checks for due reminders
- Sends reminder messages to users
- Removes completed reminders

#### 2. Giveaway Checking (Every Minute)
- Checks for ended giveaways
- Selects winners
- Announces results
- Updates giveaway status

#### 3. Sprint Management
- **On Startup**: Resumes active sprints
- **Auto-End**: Ends sprints when time expires
- **Reminders**: Sends reminders at 5min, 1min, 30sec marks

### Sprint Functions

```javascript
// Resume active sprints on bot startup
async resumeActiveSprints(client)

// End a sprint and announce results
async endSprint(client, sprintId)

// Send reminder to sprint participants
async sendSprintReminder(client, sprintId, timeLeft)
```

### Usage

Sprint commands import these functions:
```javascript
const { resumeActiveSprints, endSprint, sendSprintReminder } = 
  require('../../events/system/backgroundTasks');
```

---

## Logger System

### Auto-Context Error Logging

**Usage**:
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

### Status

✅ All 100+ commands converted  
✅ ~1,477 lines of code removed  
✅ Consistent logging across entire codebase

---

## Help System

### Consistent Help Display

All commands use `runHelpCommand()` for error handling instead of inline usage strings.

**Pattern**:
```javascript
const { runHelpCommand } = require('../../utils/embeds/helpEmbedBuilder');

// When user makes a mistake
if (!validInput) {
  return runHelpCommand(client, message, commandName);
}
```

### What Users See

- Full paginated help embeds
- All subcommands listed
- Proper syntax and examples
- Navigation buttons
- Consistent experience

### Status

✅ 14 command files updated  
✅ 34 inline usage strings replaced  
✅ Validation error messages preserved (good UX)  
✅ Dev folder excluded (as requested)

---

## Utils Structure

### Current Organization

```
utils/
├── helpers.js              # Combined command helpers
│   ├── Roleplay functions
│   ├── NSFW roleplay functions
│   └── Spotify helper functions
│
├── embeds/                 # Embed builders
│   ├── embedbuilder.js
│   ├── helpEmbedBuilder.js
│   └── helpPagination.js
│
├── commandProcessor.js     # Command execution
├── permissions.js          # Permission checks
├── logger.js              # Auto-context logger
└── webhookLogger.js       # Webhook logging utility
```

### helpers.js Exports

**Roleplay**:
- `createRoleplayCommand(action, gifType)`
- `fetchWaifuGif(gifType)`
- `getOrdinal(number)`

**NSFW Roleplay**:
- `createNSFWRoleplayCommand(action, gifType)`
- `fetchNSFWGif(gifType)`
- `isNSFWChannel(channel)`

**Spotify**:
- `checkSpotifyAccess(userService, userId, message)`
- `checkActiveDevices(spotifyService, userId, message)`
- `handleSpotifyError(error, message)`

### Import Examples

```javascript
// Roleplay
const { createRoleplayCommand } = require('../../utils/helpers');

// Embeds
const embeds = require('../../utils/embeds/embedbuilder');

// Logger
const logger = require('../../utils/logger');
```

---

---

## Quick Reference

### Service Access
```javascript
const { getService } = require('@services');
const userService = getService('user');
const guildService = getService('guild');
```

### Error Logging
```javascript
const logger = require('../../utils/logger');
logger.webhook.error(error, message);
```

### Help Command
```javascript
const { runHelpCommand } = require('../../utils/embeds/helpEmbedBuilder');
return runHelpCommand(message, 'commandname');
```

### Embeds
```javascript
const embeds = require('../../utils/embeds/embedbuilder');
const embed = embeds.successEmbed('Title', 'Description');
```

---
