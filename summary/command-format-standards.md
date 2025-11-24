# Command Format Standards

This document outlines the required format and standards for all commands in the adore bot codebase.

---

## 📋 Module.exports Requirements

Every command file must have these fields in `module.exports`:

### Required Fields

```javascript
module.exports = {
  name: "commandname",           // Command name (lowercase)
  description: "Description",     // What the command does
  syntax: 'command [required] (optional)',  // Usage format
  example: 'command value',       // Example usage
  run: async (client, message, args) => { }
}
```

### Optional Fields

```javascript
aliases: ['alias1', 'alias2'],    // Alternative command names
permission: 'permission_name',    // Required permission
isGroupCommand: true,             // Has subcommands (uses switch/case)
global: true,                     // Can be used in DMs (no guild required)
```

---

## 🔤 Syntax Format Rules

### Parameter Notation

- **[required]** - Required parameters use square brackets
- **(optional)** - Optional parameters use parentheses

### Examples

```javascript
// Simple command with required parameter
syntax: 'ban [user] (reason)'

// Command with optional parameter only
syntax: 'avatar (user)'

// Group command with subcommands
syntax: 'antinuke [subcommand] (parameters)'

// Command with multiple required parameters
syntax: 'fakepermissions add [role] [permissions]'

// Command with no parameters
syntax: 'ping'
```

### Common Patterns

| Pattern | Example | Description |
|---------|---------|-------------|
| `[user]` | `ban [user]` | User mention/ID required |
| `(user)` | `avatar (user)` | User mention/ID optional |
| `[state]` | `antiraid age [state]` | on/off required |
| `(threshold)` | `antinuke role [state] (threshold)` | Number optional |
| `(punishment)` | `antinuke ban [state] (threshold) (punishment)` | Action type optional |
| `[subcommand]` | `prefix [subcommand]` | Subcommand required |
| `[role] [permissions]` | `fakepermissions add [role] [permissions]` | Multiple required |

---

## 📝 Example Format Rules

The `example` field should show a realistic usage:

```javascript
// ✅ GOOD - Shows actual usage
example: 'ban @user Spamming'
example: 'antiraid age on --threshold 7 --do ban'
example: 'avatar @user'

// ❌ BAD - Too generic or unclear
example: 'ban user reason'
example: 'command'
```

---

## 🔤 Bold Text Formatting in Messages

Use **bold** formatting (`**text**`) to emphasize key words in user-facing messages:

### When to Use Bold

- **Feature names**: No selfreact, Antinuke, role names
- **Action words**: enabled, disabled, changed, added, removed, reset, banned, kicked, unbanned
- **Important values**: usernames (with tag), role names, permission names
- **Status indicators**: already enabled/disabled
- **Key phrases**: bypass list, whitelist, server owner, antinuke admins
- **Negations**: can't, cannot (when showing restrictions)

### Examples from Codebase

```javascript
// ✅ Feature toggles
embeds.success(message, '**No selfreact** has been **enabled**');
embeds.success(message, '**No selfreact** has been **disabled**');
embeds.success(message, `${enabled ? 'Enabled' : 'Disabled'} **${moduleName}** protection`);

// ✅ User actions
embeds.success(message, `**${user.tag}** has been **banned** for ${reason}`);
embeds.success(message, `**${user.user.tag}** has been **unbanned** for ${reason}`);
embeds.success(message, `**${user.user.username}** has been **unjailed** for ${reason}`);
embeds.success(message, `**${user.user.tag}** has been **image muted** in this channel for ${reason}`);

// ✅ List modifications
embeds.success(message, `Added ${targetUser} to **bypass list**`);
embeds.success(message, `Removed ${targetUser} from **bypass list**`);
embeds.success(message, `Added **${target.tag}** to the antinuke whitelist`);
embeds.success(message, `Added **${target.tag}** as an antinuke admin`);

// ✅ Value changes
embeds.success(message, `Server prefix has been **changed** to \`${newPrefix}\``);
embeds.success(message, `Server prefix has been **reset** to default \`${defaultPrefix}\``);
embeds.info(message, `Your Server **prefix:** \`${guildPrefix}\``);

// ✅ Permission errors
embeds.deny(message, 'You need **Administrator** permission to use this command');
embeds.deny(message, 'I need **Ban Members** permission to use this command');
embeds.deny(message, 'I need **Manage Messages** permission to remove self-reactions');
embeds.deny(message, 'Only the **server owner** or **antinuke admins** can use this command');

// ✅ Already exists / status checks
embeds.warn(message, 'No self-react is already **enabled**');
embeds.warn(message, 'No self-react is already **disabled**');
embeds.warn(message, `**${user.user.username}** is already image muted in this channel`);
embeds.warn(message, `**${user.user.username}** is not jailed`);
embeds.warn(message, `**${target.tag}** is already whitelisted`);

// ✅ Missing input / instructions
embeds.deny(message, 'Please **mention a user** to bypass');
embeds.warn(message, 'Please mention a user or bot to whitelist: `,antinuke whitelist @user`');

// ✅ Restrictions / limitations
embeds.warn(message, "Prefix **can't** be over 3 characters");
embeds.warn(message, "Prefix **can't** contain spaces");
embeds.deny(message, 'Cannot delete messages **older than 14 days** due to Discord limitations');

// ✅ Case/history references
embeds.deny(message, 'Please provide a **valid case ID** number');
embeds.success(message, `Removed case #${caseId} for **${userResult.user.user.username}**`);
embeds.success(message, `Removed **${result.deletedCount}** case${result.deletedCount === 1 ? '' : 's'} for **${userResult.user.user.username}**`);

// ❌ BAD - No emphasis on key words
embeds.success(message, 'No selfreact has been enabled');
embeds.success(message, `${user.tag} has been banned for ${reason}`);
embeds.warn(message, 'No self-react is already disabled');
```

### Formatting Patterns

| Message Type | Pattern | Example |
|--------------|---------|---------|
| Feature toggle | `**Feature** has been **action**` | `**No selfreact** has been **enabled**` |
| User action | `**User.tag** has been **action** for reason` | `**${user.tag}** has been **banned** for ${reason}` |
| Value change | `X has been **action** to \`value\`` | `Server prefix has been **changed** to \`!\`` |
| List modification | `Added/Removed X to/from **list**` | `Added ${user} to **bypass list**` |
| Permission error | `You/I need **Permission** permission` | `You need **Administrator** permission` |
| Authority check | `Only the **role** can use this` | `Only the **server owner** can add admins` |
| Already exists | `X is already **state**` | `No self-react is already **enabled**` |
| Not exists | `**User** is not **state**` | `**${user}** is not jailed` |
| Missing input | `Please **action** X` | `Please **mention a user** to bypass` |
| Restrictions | `X **can't** be Y` | `Prefix **can't** be over 3 characters` |
| Limitations | `Cannot do X **reason**` | `Cannot delete messages **older than 14 days**` |

### Combining Bold with Code Blocks and User Mentions

```javascript
// Use backticks for values/numbers, bold for feature names and actions
embeds.success(message, `Threshold has been **set** to \`${threshold}\``);
embeds.info(message, `Your Server **prefix:** \`${guildPrefix}\``);
embeds.warn(message, `Prefix **can't** be over \`3\` characters`);

// User mentions stay as-is, bold the feature/action
embeds.success(message, `Added ${targetUser} to **bypass list**`);
embeds.success(message, `**${user.tag}** has been **banned** for ${reason}`);

// Bold both the username AND the action
embeds.success(message, `**${user.user.username}** has been **unjailed** for ${reason}`);
```

### Don't Overuse Bold

```javascript
// ❌ BAD - Too much bold
embeds.success(message, '**No** **selfreact** **has** **been** **enabled**');
embeds.success(message, '**Added** **${user}** **to** **bypass** **list**');

// ✅ GOOD - Only key words (feature name + action, or user + action)
embeds.success(message, '**No selfreact** has been **enabled**');
embeds.success(message, `Added ${user} to **bypass list**`);
embeds.success(message, `**${user.tag}** has been **banned** for ${reason}`);
```

---

## ⚠️ Error Handling

All commands should use the webhook logger system for error handling:

### Error Logging Pattern

```javascript
const logger = require('../../utils/logger');

module.exports = {
  name: "commandname",
  // ... other fields
  run: async (client, message, args) => {
    try {
      // Command logic here
      
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while executing this command');
    }
  }
};
```

### Rules

- **Always wrap command logic in try/catch**
- **Use `logger.webhook.error(error, message)` for all errors**
- **Never use `console.error()` or `console.log()` for errors**
- **Provide user-friendly error messages with embeds.deny()**
- **Include context in error messages when helpful**

### Examples

```javascript
// ✅ GOOD - Uses webhook logger
try {
  const result = await someOperation();
} catch (error) {
  logger.webhook.error(error, message);
  return embeds.deny(message, 'An error occurred while processing your request');
}

// ✅ GOOD - With additional context
try {
  await userService.updateData(userId, data);
} catch (error) {
  logger.webhook.error(error, message);
  return embeds.deny(message, 'Failed to update user data. Please try again.');
}

// ❌ BAD - Uses console.error
try {
  const result = await someOperation();
} catch (error) {
  console.error(error);
  return embeds.deny(message, 'An error occurred');
}

// ❌ BAD - No error handling at all
const result = await someOperation(); // Could crash the bot!
```

---

## 🔀 Group Commands (isGroupCommand: true)

Commands with subcommands must follow this structure:

### Structure Requirements

1. **Set `isGroupCommand: true`** in module.exports
2. **Use switch/case statement** (not if/else)
3. **Check for missing args** before switch
4. **Each case has its own scope** with `{}`
5. **Include subcommandInfo** in each case
6. **Have a default case** that shows help

### Template

```javascript
module.exports = {
  name: "commandname",
  description: "Description",
  syntax: 'commandname [subcommand] (parameters)',
  example: 'commandname subcommand value',
  isGroupCommand: true,
  run: async (client, message, args) => {
    
    // Check for missing subcommand
    if (!args[0]) {
      const { runHelpCommand } = require('../../utils/commandProcessor');
      return runHelpCommand(message, 'commandname');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'subcommand1': {
        const subcommandInfo = {
          description: 'Subcommand description',
          usage: '{guildprefix}commandname subcommand1 [param]',
          aliases: [],
          example: '{guildprefix}commandname subcommand1 value'
        };
        
        // Subcommand logic here
        break;
      }

      case 'subcommand2': {
        const subcommandInfo = {
          description: 'Subcommand description',
          usage: '{guildprefix}commandname subcommand2 (param)',
          aliases: [],
          example: '{guildprefix}commandname subcommand2'
        };
        
        // Subcommand logic here
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

### SubcommandInfo Format

Each case block must include:

```javascript
const subcommandInfo = {
  description: 'What this subcommand does',
  usage: '{guildprefix}command subcommand [required] (optional)',
  aliases: [],  // Alternative names for this subcommand
  example: '{guildprefix}command subcommand value'
};
```

**Note**: Use `{guildprefix}` placeholder in usage/example - it gets replaced with actual prefix

---

## 🌍 Global Commands

Commands that can be used in DMs (outside of guilds) must:

1. **Set `global: true`** in module.exports
2. **Handle missing guild context** gracefully
3. **Not require guild-specific data** (roles, channels, etc.)

### Examples of Global Commands

```javascript
// ✅ Can be global - no guild data needed
- ping
- help
- botinfo
- avatar (for self)

// ❌ Cannot be global - requires guild
- ban (needs guild members)
- prefix (needs guild settings)
- antinuke (needs guild configuration)
```

### Global Command Template

```javascript
module.exports = {
  name: "commandname",
  description: "Description",
  syntax: 'commandname (parameter)',
  example: 'commandname',
  global: true,  // Can be used in DMs
  run: async (client, message, args) => {
    // Command logic that doesn't require message.guild
  }
};
```

---

## ✅ Checklist for All Commands

Use this checklist when creating or updating commands:

### Basic Requirements
- [ ] Has `name` field
- [ ] Has `description` field
- [ ] Has `syntax` field with proper `[required]` and `(optional)` notation
- [ ] Has `example` field with realistic usage
- [ ] Has `run` function

### Group Commands (if applicable)
- [ ] Has `isGroupCommand: true`
- [ ] Uses `switch/case` statement (not if/else chains)
- [ ] Checks `if (!args[0])` before switch
- [ ] Each case has `{}` scope
- [ ] Each case has `subcommandInfo` object
- [ ] Has `default` case that calls help
- [ ] SubcommandInfo uses `{guildprefix}` placeholder

### Global Commands (if applicable)
- [ ] Has `global: true` if command works in DMs
- [ ] Doesn't access `message.guild` without checking if it exists
- [ ] Doesn't require guild-specific features

### Parameter Format
- [ ] Required parameters use `[brackets]`
- [ ] Optional parameters use `(parentheses)`
- [ ] Syntax matches actual command behavior
- [ ] Example shows realistic usage

### Message Formatting
- [ ] User-facing messages use **bold** for key words (actions, values, statuses)
- [ ] Important values use backticks for code formatting
- [ ] Bold is not overused (only 2-4 bold words per message)

### Error Handling
- [ ] Command logic wrapped in try/catch block
- [ ] Uses `logger.webhook.error(error, message)` for errors
- [ ] Never uses `console.error()` or `console.log()` for errors
- [ ] Provides user-friendly error message with `embeds.deny()`

---

## 🔍 Common Issues

### Issue: Using if/else instead of switch/case

```javascript
// ❌ BAD - if/else chain
if (args[0] === 'on') {
  // ...
} else if (args[0] === 'off') {
  // ...
}

// ✅ GOOD - switch/case
switch (args[0]?.toLowerCase()) {
  case 'on': {
    // ...
    break;
  }
  case 'off': {
    // ...
    break;
  }
}
```

### Issue: Missing syntax/example fields

```javascript
// ❌ BAD - Missing fields
module.exports = {
  name: "ban",
  description: "Ban a user",
  run: async (client, message, args) => { }
}

// ✅ GOOD - All fields present
module.exports = {
  name: "ban",
  description: "Ban a user",
  syntax: 'ban [user] (reason)',
  example: 'ban @user Spamming',
  run: async (client, message, args) => { }
}
```

### Issue: Wrong parameter notation

```javascript
// ❌ BAD - Using <> or other notation
syntax: 'ban <user> [reason]'
syntax: 'ban user reason'

// ✅ GOOD - Using [] for required, () for optional
syntax: 'ban [user] (reason)'
```

### Issue: Global command accessing guild

```javascript
// ❌ BAD - Global command accessing guild without check
module.exports = {
  name: "command",
  global: true,
  run: async (client, message, args) => {
    const member = message.guild.members.cache.get(args[0]); // Will crash in DMs!
  }
}

// ✅ GOOD - Check for guild first
module.exports = {
  name: "command",
  global: true,
  run: async (client, message, args) => {
    if (!message.guild) {
      return message.reply('This command can only be used in servers');
    }
    const member = message.guild.members.cache.get(args[0]);
  }
}
```

---

## 📊 Command Categories

### Commands by Type

**Simple Commands** (no subcommands):
- Use basic module.exports format
- Single `run` function
- Example: `ping`, `avatar`, `ban`

**Group Commands** (with subcommands):
- Set `isGroupCommand: true`
- Use switch/case structure
- Each subcommand has subcommandInfo
- Example: `antinuke`, `antiraid`, `prefix`

**Global Commands** (work in DMs):
- Set `global: true`
- Don't require guild context
- Example: `help`, `botinfo`, `ping`

---

## 🎯 Examples from Codebase

### Simple Command Example (rename.js)

```javascript
module.exports = {
  name: "rename",
  aliases: ['nick'],
  description: `change a member's nickname`,
  syntax: 'rename [user] [nickname]',
  example: 'rename @vwsn NewName',
  run: async(client, message, args) => {
    // Command logic
  }
}
```

### Group Command Example (antinuke.js)

```javascript
module.exports = {
  name: 'antinuke',
  aliases: ['an'],
  description: 'Antinuke protection system',
  syntax: 'antinuke [subcommand] (parameters)',
  example: 'antinuke role on --threshold 5 --do kick',
  isGroupCommand: true,
  run: async (client, message, args) => {
    if (!args[0]) {
      return runHelpCommand(message, 'antinuke');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'role': {
        const subcommandInfo = {
          description: 'Prevent mass role delete',
          usage: '{guildprefix}antinuke role [state] (threshold) (punishment)',
          aliases: [],
          example: '{guildprefix}antinuke role on --threshold 5 --do kick'
        };
        // Logic here
        break;
      }
      
      default: {
        return runHelpCommand(message, 'antinuke');
      }
    }
  }
};
```

### Global Command Example (ping.js)

```javascript
module.exports = {
  name: "latency",
  aliases: ['ms', 'ping'],
  description: `Shows bot's latency response times`,
  syntax: 'latency',
  example: 'latency',
  global: true,  // Can be used in DMs
  run: async (client, message, args) => {
    // No guild access needed
    const msg = await message.channel.send("latency...");
    // ...
  }
}
```

---

**Last Updated**: November 24, 2025
