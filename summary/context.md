# adore Bot - Complete Codebase Context

**Last Updated**: November 20, 2025  
**Purpose**: Centralized knowledge base containing all essential context about the adore Discord bot

---

## 📊 Project Overview

### Basic Information
- **Name**: adore (always lowercase)
- **Type**: Feature-rich Discord moderation & utility bot (NOT an AI bot, though it has an AI assistant command)
- **Framework**: Discord.js v14.21.0
- **Runtime**: Node.js
- **Database**: MongoDB with Mongoose (v6.6.0)
- **Cache**: Redis (ioredis v5.6.1)
- **Default Prefix**: `,` (customizable per server)
- **Support Server**: https://dsc.gg/s-invite

### Key Statistics
- **Total Commands**: 178 in `commands/`
- **Total Events**: 34 event handlers
- **Slash Commands**: 1 (confess.js)
- **Database Services**: 14 services
- **Models**: 3 Mongoose schemas
- **Utilities**: 9 utility modules
- **Dependencies**: 35 npm packages

---

## 🏗️ Architecture Overview

### Directory Structure
```
adore/
├── commands/          # 178 command files organized by category
│   ├── antinuke/     # Server protection commands
│   ├── dev/          # Developer-only commands
│   ├── essentials/   # Core bot commands
│   ├── fun/          # Entertainment commands
│   ├── gamble/       # Economy & gambling
│   ├── information/  # Info/stats commands
│   ├── lastfm/       # Last.fm integration
│   ├── miscellaneous/
│   ├── moderation/   # Mod tools (ban, kick, mute, etc.)
│   ├── premium/      # Premium-only features
│   ├── purge/        # Message cleanup
│   ├── roleplay/     # RP commands with GIFs
│   ├── server/       # Server management
│   ├── service/      # Service integrations
│   ├── snipes/       # Message snipe system
│   ├── socials/      # Social integrations
│   ├── spotify/      # Spotify integration
│   └── utility/      # Utility commands
├── commandSlash/     # Slash commands (1 file: confess.js)
├── events/           # 34 event handlers
│   ├── automod/     # Automated moderation
│   ├── dev/         # Developer events
│   ├── interaction/ # Slash command & button handling
│   ├── message/     # Message events
│   ├── reaction/    # Reaction handling
│   ├── server/      # Guild events
│   ├── system/      # System events (ready, backgroundTasks)
│   └── user/        # User events
├── database/        # Database layer
│   ├── cache/       # Cache implementation
│   ├── models/      # Mongoose schemas (3 models)
│   └── services/    # Service layer (14 services)
├── handlers/        # Command & event loaders
├── utils/           # 9 utility modules
├── config/          # Bot configuration
├── core/            # Core systems (buttons, embeds)
├── summary/         # Documentation (4 files)
└── backups/         # Guild data backups
```

### Service Layer Architecture

The bot uses a sophisticated 3-tier service pattern:

```
database/services/
├── core/                    # Infrastructure
│   ├── BaseService.js       # Base class for all services
│   ├── SmartCache.js        # LRU cache with TTL
│   ├── connection.js        # MongoDB connection with retry
│   ├── CacheWarmer.js       # Preload frequently accessed data
│   └── PerformanceMonitor.js# Performance tracking
├── data/                    # Data services (1:1 with collections)
│   ├── GuildService.js      # Guild collection operations
│   ├── UserService.js       # User collection operations
│   └── SystemService.js     # System collection operations
└── features/                # Feature services (combine data)
    ├── PrefixService.js     # Prefix management
    └── SpotifyService.js    # Spotify integration
```

**Usage Pattern**:
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

### Module Aliases (package.json)
```javascript
@services  → database/services
@core      → database/services/core
@models    → database/models
@utils     → utils
@config    → config
@handlers  → handlers
```

---

## 🔧 Technical Systems

### Caching Strategy

**Type**: Write-through caching with LRU eviction

**Configuration**:
- **UserService**: 45min TTL, 10,000 max users
- **GuildService**: 60min TTL, 5,000 max guilds
- **Expected hit rate**: 80-90% overall, 95%+ for active users
- **Memory usage**: ~20-50MB for 10,000 users

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

### Logger System

Auto-context error logging with webhook support:

```javascript
const logger = require('../../utils/logger');

try {
  // Command logic
} catch (error) {
  logger.webhook.error(error, message);
}
```

**What it does automatically**:
1. Extracts user info from `message.author`
2. Extracts guild info from `message.guild`
3. Extracts channel info from `message.channel`
4. Detects command name from call stack
5. Parses arguments from `message.content`

**Status**: All 100+ commands converted (~1,477 lines removed in refactor)

### Help System

Consistent paginated help with `runHelpCommand()`:

```javascript
const { runHelpCommand } = require('../../utils/embeds/helpEmbedBuilder');

if (!validInput) {
  return runHelpCommand(client, message, commandName);
}
```

**Features**:
- Full paginated help embeds
- All subcommands listed
- Proper syntax and examples
- Navigation buttons

### Background Tasks

Location: `events/system/backgroundTasks.js`

**Tasks**:
1. **Reminder checking**: Every minute
2. **Giveaway management**: Auto-end and winner selection every minute
3. **Sprint management**: Resume on startup, auto-end, reminders

### Data Loss Prevention

Detection system for missing important fields before writes:

```javascript
// Monitored fields
const importantFields = [
  'WelcomeChannel', 'WelcomeMessage', 'WelcomeMessages',
  'LeaveChannel', 'LeaveMessage', 'LeaveMessages',
  'BoostChannel', 'BoostMessage', 'BoostMessages',
  'AutoRoles', 'Aliases', 'Antinuke', 'VoiceMaster',
  'StarboardChannel', 'LoggingConfig', 'LevelSystem'
];
```

Webhook alerts are sent when important data might be lost during writes.

---

## 🎯 Core Features

### 1. Moderation System

Complete suite of moderation tools:

**Actions**:
- `ban`, `massban`, `unban` - Ban management with duration support
- `kick`, `masskick` - Kick members
- `mute`, `unmute` - Text mute
- `imagemute`, `unimagemute` - Image/attachment mute
- `reactionmute`, `unreactionmute` - Reaction mute
- `jail`, `unjail` - Restrict to jail channel
- `warn`, `warnings`, `clearwarnings` - Warning system

**Features**:
- Case logging to `#jail-log` channel
- Temporary punishments with duration (`1h`, `7d`, etc.)
- DM notifications to users
- Complete moderation history per user
- 4 mute types: text, image, reaction, jail

**Setup**:
```
,setup        # Creates #jail-log, Jailed role, #jail channel
,setupmute    # Creates Muted, Image Muted, Reaction Muted roles
```

### 2. Antinuke System

Advanced server protection against malicious moderators and compromised accounts.

**Modules**:

1. **Ban Protection** (`,antinuke ban <on|off> [--threshold X] [--do punishment]`)
   - Protects against mass member bans
   - Recommended: `--threshold 3 --do ban`

2. **Kick Protection** (`,antinuke kick ...`)
   - Protects against mass kicks
   - Recommended: `--threshold 3 --do ban`

3. **Role Protection** (`,antinuke role ...`)
   - Protects against mass role deletions
   - Recommended: `--threshold 5 --do kick`

4. **Channel Protection** (`,antinuke channel ...`)
   - Protects against mass channel creation/deletion
   - Recommended: `--threshold 5 --do kick`

5. **Webhook Protection** (`,antinuke webhook ...`)
   - Protects against mass webhook creation
   - Recommended: `--threshold 3 --do ban`

6. **Bot Add Protection** (`,antinuke botadd <on|off> [--do punishment]`)
   - Protects against unauthorized bot additions
   - No threshold - any bot add triggers it
   - Recommended: `--do ban`

7. **Permission Protection** (`,antinuke permissions <on|off> [--do punishment]`)
   - Protects against dangerous permission grants
   - Monitors: Administrator, Ban Members, Kick Members, etc.
   - No threshold - any dangerous permission grant triggers it
   - Recommended: `--do strip`

**Punishment Types**:
- **Strip**: Remove all roles from violator
- **Kick**: Remove from server (can rejoin)
- **Ban**: Permanently remove from server

**Management**:
- `,antinuke admin @user` - Grant antinuke admin permissions
- `,antinuke whitelist @user` - Bypass all antinuke checks
- `,antinuke config` - View complete configuration
- `,antinuke list` - Quick overview

### 3. Customization System

Per-server bot customization:
- Custom bot avatar
- Custom bot banner
- Custom bot bio/status
- Custom prefix
- Rich embed system with 50+ variables

### 4. Embed System

Powerful scripting language with variables:

**User Variables**:
- `{user}`, `{user.mention}`, `{user.id}`, `{user.name}`, `{user.tag}`, `{user.avatar}`

**Server Variables**:
- `{server}`, `{server.name}`, `{server.members}`, `{server.id}`, `{server.owner}`

**Features**:
- Custom colors
- Image/thumbnail support
- Field support
- Author/footer customization

### 5. Server Configuration

- **Welcome/Leave Messages**: Multi-message support with variables
- **Boost Messages**: Customizable boost announcements
- **Auto-roles**: Automatically assign roles on join
- **Starboard System**: Pin messages with reactions
- **Logging Configuration**: Comprehensive server logging
- **Level System**: XP and leveling
- **Voice Master**: Voice channel management

### 6. Integrations

**Spotify**:
- Full playback control
- Search functionality
- Queue management
- Currently playing display

**Last.fm**:
- Music scrobbling
- Stats and charts
- User comparisons

**AI Assistant**:
- `,ask` command using DeepInfra API

### 7. Economy & Gambling

Complete economy system with gambling features

### 8. Message Management

- **Purge**: Bulk delete messages (1-100)
- **Cleanup**: Remove bot messages
- **Word Filter**: Auto-delete filtered words
- **Snipe System**: View recently deleted messages

---

## 🗄️ Database Design

### Collections

1. **User Collection**
   - User-specific data
   - Economy data
   - Spotify tokens
   - User settings

2. **Guild Collection**
   - Server configuration
   - Welcome/leave messages
   - Antinuke settings
   - Auto-roles
   - Custom prefix
   - Logging config

3. **System Collection**
   - Bot-wide data

### Backup System

- Automatic guild data backups
- Stored in `/backups/` directory
- Format: `guilds-backup-YYYY-MM-DDTHH-mm-ss-SSSZ.json`

---

## ⚙️ Configuration

### Environment Variables

**Required**:
- `BOT_TOKEN` - Discord bot token
- `DEV_ID` - Developer user ID
- `SERVER_ID` - Development server ID
- `USER_DATABASE` - MongoDB connection string for users
- `GUILD_DATABASE` - MongoDB connection string for guilds

**Recommended**:
- `CLIENT_ID` - Bot client ID
- `ERROR_WEBHOOK_URL` - Webhook for error logging
- `GUILD_WEBHOOK_URL` - Webhook for guild events
- `PREMIUM_ROLE_ID` - Premium role for permission checks
- `DEV_ROLE_ID` - Developer role for permission checks

**Optional**:
- `LASTFM_API_KEY` - Last.fm API key
- `DEEP_API` - DeepInfra API key for AI assistant

### Color Scheme

```javascript
colors: {
  cooldown: '#a5eb78',  // Light green
  success: '#a4ec7c',   // Green
  error: '#fc6464',     // Red
  warn: '#fbd03b',      // Yellow
  info: '#e1d4da',      // Light pink
  embed: '#e1d4da',     // Light pink
  spotify: '#1cdc64'    // Spotify green
}
```

### Custom Emojis

The bot uses custom emojis for:
- Status indicators (success, error, warn, loading)
- Navigation (left, right, cancel, choose)
- Social platforms (Last.fm, Spotify)
- Voice manager controls (lock, unlock, hide, unhide)
- Level progress bars
- Ranks (bronze, silver, gold)

---

## 🔒 Error Handling

### Global Error Handlers

**Process-level**:
- `uncaughtException` handler with EIO/broken pipe protection
- `unhandledRejection` handler
- `SIGINT` and `SIGTERM` graceful shutdown

**Discord.js-level**:
- `client.on('error')` handler
- `client.on('warn')` handler

**Stdout/Stderr Protection**:
```javascript
process.stdout.on('error', (err) => {
  if (err.code === 'EIO' || err.code === 'EPIPE') {
    return; // Ignore broken pipe errors
  }
});
```

### Webhook Error Logging

All errors are logged to Discord webhook with:
- Command name and arguments
- Full error stack trace
- User, guild, and channel context
- Timestamp

---

## 🛠️ Utilities

### Finder Utilities (`handlers/finder.js`)

Helper functions attached to client:
```javascript
client.findRole(interaction, query)
client.findUser(interaction, query)
client.findChannel(interaction, query)
client.findGuild(query)
```

### Helpers (`utils/helpers.js`)

**Roleplay Functions**:
- `createRoleplayCommand(action, gifType)`
- `fetchWaifuGif(gifType)`
- `getOrdinal(number)`

**NSFW Roleplay**:
- `createNSFWRoleplayCommand(action, gifType)`
- `fetchNSFWGif(gifType)`
- `isNSFWChannel(channel)`

**Spotify Functions**:
- `checkSpotifyAccess(userService, userId, message)`
- `checkActiveDevices(spotifyService, userId, message)`
- `handleSpotifyError(error, message)`

### Embed Builders (`utils/embeds/`)

```javascript
const embeds = require('@utils/embeds/embedbuilder');

// Create embeds
const embed = embeds.successEmbed('Title', 'Description');
const embed = embeds.errorEmbed('Title', 'Description');
const embed = embeds.infoEmbed('Title', 'Description');
```

### Permissions (`utils/permissions.js`)

Attached to client as `client.permissions`:
- Permission validation
- Hierarchy checks
- Role comparison

---

## 📚 Documentation Files

Located in `summary/` folder:

1. **bot-info.md** (59,610 bytes)
   - Ultra-detailed user guide
   - Feature explanations
   - Command documentation
   - Tutorials and examples

2. **documentation.md** (11,559 bytes)
   - Technical architecture
   - Service layer documentation
   - Cache system design
   - Best practices

3. **guildresetbug.md** (11,678 bytes)
   - Bug analysis and fixes
   - Data loss prevention

4. **overview.json** (101,873 bytes)
   - Structured bot overview
   - Complete feature list

5. **codebase-context.md** (this file)
   - Centralized knowledge base
   - Complete codebase context

---

## 🎨 Design Philosophy

1. **Security-first**: Antinuke system as core feature
2. **Customization**: Per-server bot customization for unique branding
3. **Service layer**: Clean abstraction over database operations
4. **Caching**: Performance optimization with Redis and LRU cache
5. **Logging**: Comprehensive error tracking with auto-context
6. **Consistency**: Standardized patterns across all commands
7. **Data integrity**: Write-through caching and data loss prevention

---

## 📦 Key Dependencies

**Core**:
- `discord.js` v14.21.0 - Discord API wrapper
- `mongodb` v6.17.0 - Database driver
- `mongoose` v6.6.0 - MongoDB ODM
- `ioredis` v5.6.1 - Redis client for caching

**APIs**:
- `axios` v1.10.0 - HTTP requests
- `got` v14.4.2 - Alternative HTTP client

**Media Processing**:
- `canvas` v3.2.0 - Image generation
- `sharp` v0.34.4 - Image processing
- `jimp` v0.22.12 - Image manipulation
- `fluent-ffmpeg` v2.1.3 - Audio/video processing

**Utilities**:
- `luxon` v3.6.1 - Date/time handling
- `moment` v2.29.4 - Date/time utilities
- `ms` v2.1.3 - Duration parsing
- `chalk` v4.1.2 - Terminal styling
- `dotenv` v16.5.0 - Environment variables

**Web**:
- `express` v4.21.2 - Web server

**Production**:
- `pm2` v5.3.0 - Process manager

---

## 🔄 Recent Changes & Status

### Logger System Refactor
- ✅ All 100+ commands converted to new logger
- ✅ ~1,477 lines of code removed
- ✅ Consistent error logging across entire codebase

### Help System Standardization
- ✅ 14 command files updated
- ✅ 34 inline usage strings replaced with `runHelpCommand()`
- ✅ Validation error messages preserved for UX

### Data Loss Prevention
- ✅ Detection system implemented in `GuildService.writeToDatabase()`
- ✅ Webhook alerts for missing important fields
- ✅ Monitoring active for all guild data writes

---

## 🚦 Best Practices

### Service Layer
```javascript
// ✅ CORRECT
const guildData = await guildService.ensureGuildData(guildId);
guildData.WelcomeChannel = channelId;
await guildService.set(guildId, guildData);

// ❌ WRONG - Loses other fields
const partialData = { GuildID: guildId, WelcomeChannel: channelId };
await guildService.set(guildId, partialData);
```

### Error Handling
```javascript
// ✅ CORRECT - Auto-context logging
const logger = require('@utils/logger');
try {
  // Command logic
} catch (error) {
  logger.webhook.error(error, message);
}
```

### Help Display
```javascript
// ✅ CORRECT - Consistent help
const { runHelpCommand } = require('@utils/embeds/helpEmbedBuilder');
if (!validInput) {
  return runHelpCommand(client, message, commandName);
}
```

### Cache Management
```javascript
// ✅ DO
- Always use this.set() for writes
- Always use this.get() for reads
- Use ensureUserData() to guarantee user exists

// ❌ DON'T
- Don't bypass cache with direct MongoDB operations
- Don't modify cached objects without calling this.set()
```

---

## 📞 Support & Resources

- **Support Server**: https://dsc.gg/s-invite
- **Invite Link**: Auto-generated from CLIENT_ID
- **Documentation**: `/summary/` folder
- **Backups**: `/backups/` folder

---

**EOF - Complete Codebase Context**
