# adore Bot - Codebase Context

**Last Updated**: November 24, 2025  
**Purpose**: Essential context for the adore Discord bot codebase

---

## 📊 Project Overview

- **Name**: adore (always lowercase)
- **Type**: Discord moderation & utility bot
- **Framework**: Discord.js v14.21.0
- **Database**: MongoDB with Mongoose + Redis cache
- **Default Prefix**: `,` (customizable per server)
- **Support**: https://dsc.gg/s-invite

---

## 🏗️ Architecture

### Directory Structure
```
adore/
├── commands/         # 178 commands by category
├── events/          # 34 event handlers
├── database/        # Models, services, cache
├── handlers/        # Command & event loaders
├── utils/           # Utilities & helpers
├── config/          # Bot configuration
├── core/            # Buttons & embeds
└── summary/         # Documentation
```

### Service Layer
```javascript
const { getService } = require('@services');

const userService = getService('user');
const guildService = getService('guild');

// Read (cache-first)
const userData = await userService.get(userId);

// Write (write-through)
await userService.set(userId, updatedData);
```

### Module Aliases
```javascript
@services  → database/services
@models    → database/models
@utils     → utils
@config    → config
```

---

## 🔧 Core Systems

### Error Handling
```javascript
const logger = require('../../utils/logger');

try {
  // Command logic
} catch (error) {
  logger.webhook.error(error, message);
  return embeds.deny(message, 'An error occurred');
}
```

**Rules**:
- Always wrap command logic in try/catch
- Use `logger.webhook.error(error, message)` for all errors
- Never use `console.error()` or `console.log()` for errors
- Provide user-friendly error messages

### Help System
```javascript
const { runHelpCommand } = require('../../utils/embeds/helpEmbedBuilder');

if (!validInput) {
  return runHelpCommand(message, 'commandname');
}
```

### Caching
- **Type**: Write-through with LRU eviction
- **UserService**: 45min TTL, 10,000 max
- **GuildService**: 60min TTL, 5,000 max
- **Hit rate**: 80-90% overall

---

## 📝 Command Standards

### Required Fields
```javascript
module.exports = {
  name: "commandname",
  description: "Description",
  syntax: 'command [required] (optional)',
  example: 'command value',
  run: async (client, message, args) => { }
}
```

### Optional Fields
```javascript
aliases: ['alias1'],
permission: 'permission_name',
isGroupCommand: true,  // Has subcommands
global: true           // Works in DMs
```

### Syntax Format
- **[required]** - Required parameters use square brackets
- **(optional)** - Optional parameters use parentheses

Examples:
```javascript
syntax: 'ban [user] (reason)'
syntax: 'avatar (user)'
syntax: 'antinuke [subcommand] (parameters)'
```

### Group Commands
Commands with subcommands must:
1. Set `isGroupCommand: true`
2. Use switch/case (not if/else)
3. Check for missing args before switch
4. Include subcommandInfo in each case
5. Have default case that shows help

```javascript
module.exports = {
  name: "commandname",
  isGroupCommand: true,
  run: async (client, message, args) => {
    if (!args[0]) {
      const { runHelpCommand } = require('../../utils/commandProcessor');
      return runHelpCommand(message, 'commandname');
    }

    switch (args[0].toLowerCase()) {
      case 'subcommand': {
        const subcommandInfo = {
          description: 'What this does',
          usage: '{guildprefix}command subcommand [param]',
          aliases: [],
          example: '{guildprefix}command subcommand value'
        };
        // Logic here
        break;
      }
      
      default: {
        const { runHelpCommand } = require('../../utils/commandProcessor');
        return runHelpCommand(message, 'commandname');
      }
    }
  }
};
```

### Message Formatting

Use **bold** for key words in user messages:

```javascript
// Feature toggles
embeds.success(message, '**No selfreact** has been **enabled**');

// User actions
embeds.success(message, `**${user.tag}** has been **banned** for ${reason}`);

// List modifications
embeds.success(message, `Added ${user} to **bypass list**`);

// Value changes
embeds.success(message, `Prefix has been **changed** to \`${prefix}\``);

// Permission errors
embeds.deny(message, 'You need **Administrator** permission');

// Status checks
embeds.warn(message, 'No self-react is already **enabled**');

// Restrictions
embeds.warn(message, "Prefix **can't** be over 3 characters");
```

**Bold these**:
- Feature names (No selfreact, Antinuke)
- Actions (enabled, disabled, banned, kicked)
- Important values (usernames, role names)
- Status indicators (already enabled/disabled)
- Key phrases (bypass list, server owner)
- Negations (can't, cannot)

**Don't overuse**:
```javascript
// ❌ BAD - Too much bold
embeds.success(message, '**No** **selfreact** **has** **been** **enabled**');

// ✅ GOOD - Only key words
embeds.success(message, '**No selfreact** has been **enabled**');
```

---

## ⚙️ Configuration

### Environment Variables

**Required**:
- `BOT_TOKEN` - Discord bot token
- `DEV_ID` - Developer user ID
- `USER_DATABASE` - MongoDB connection for users
- `GUILD_DATABASE` - MongoDB connection for guilds

**Recommended**:
- `ERROR_WEBHOOK_URL` - Webhook for error logging
- `GUILD_WEBHOOK_URL` - Webhook for guild events

### Color Scheme
```javascript
colors: {
  success: '#a4ec7c',   // Green
  error: '#fc6464',     // Red
  warn: '#fbd03b',      // Yellow
  info: '#e1d4da',      // Light pink
  spotify: '#1cdc64'    // Spotify green
}
```

---

## 🚦 Best Practices

### Service Layer
```javascript
// ✅ CORRECT - Preserve all fields
const guildData = await guildService.ensureGuildData(guildId);
guildData.WelcomeChannel = channelId;
await guildService.set(guildId, guildData);

// ❌ WRONG - Loses other fields
const partialData = { GuildID: guildId, WelcomeChannel: channelId };
await guildService.set(guildId, partialData);
```

### Error Handling
```javascript
// ✅ CORRECT
try {
  // Logic
} catch (error) {
  logger.webhook.error(error, message);
  return embeds.deny(message, 'Error message');
}

// ❌ WRONG
try {
  // Logic
} catch (error) {
  console.error(error);  // Never use console.error
}
```

### Help Display
```javascript
// ✅ CORRECT
if (!validInput) {
  return runHelpCommand(message, 'commandname');
}

// ❌ WRONG - Inline usage strings
if (!validInput) {
  return message.reply('Usage: ,command [param]');
}
```

---

## 📚 Key Features

### Moderation
- Ban, kick, mute, jail, warn system
- Case logging to #jail-log
- Temporary punishments with duration
- 4 mute types: text, image, reaction, jail

### Antinuke
- Protection against mass bans, kicks, role/channel deletion
- Bot add protection
- Permission protection
- Whitelist & admin system
- Punishments: strip, kick, ban

### Customization
- Custom bot avatar/banner/bio per server
- Custom prefix
- Rich embed system with 50+ variables
- Welcome/leave/boost messages

### Integrations
- Spotify (playback control, search, queue)
- Last.fm (scrobbling, stats, charts)
- AI assistant (DeepInfra API)

---

## 🛠️ Utilities

### Embed Builders
```javascript
const embeds = require('@utils/embeds/embedbuilder');

embeds.success(message, 'Success message');
embeds.deny(message, 'Error message');
embeds.warn(message, 'Warning message');
embeds.info(message, 'Info message');
```

### Finder Utilities
```javascript
client.findRole(interaction, query)
client.findUser(interaction, query)
client.findChannel(interaction, query)
client.findGuild(query)
```

---

**EOF**
