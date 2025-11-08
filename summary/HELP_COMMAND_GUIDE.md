# Help Command System Guide

This guide explains how the help command works in this Discord bot, covering both **normal commands** and **group commands** (commands with subcommands).

---

## Table of Contents

1. [Overview](#overview)
2. [Normal Commands](#normal-commands)
3. [Group Commands](#group-commands)
4. [How Help Detection Works](#how-help-detection-works)
5. [Help Display System](#help-display-system)
6. [Auto-Help Feature](#auto-help-feature)
7. [Creating Your Own Commands](#creating-your-own-commands)

---

## Overview

The help system has two main components:

- **Help Command** (`commands/essentials/help.js`) - Displays detailed information about commands
- **Command Processor** (`utils/commandProcessor.js`) - Automatically shows help when commands are used incorrectly

### Basic Usage

```
!help                    # Shows bot website link
!help <command>          # Shows help for a specific command
!help <command> <sub>    # Shows help for a specific subcommand (group commands only)
```

**Aliases:** `h`, `command`

---

## Normal Commands

Normal commands are single-action commands without subcommands.

### Structure Example

```javascript
module.exports = {
  name: "ping",
  aliases: ['ms', 'latency'],
  description: `Shows bot's latency response times`,
  syntax: 'ping',
  example: 'ping',
  permission: 'Administrator', // Optional
  cooldowns: 3, // Optional, in seconds
  run: async (client, message, args) => {
    // Command logic here
  }
}
```

### Required Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | String | Command name (used to invoke it) |
| `description` | String | Brief description of what the command does |
| `run` | Function | Main execution function |

### Optional Properties

| Property | Type | Description |
|----------|------|-------------|
| `aliases` | Array | Alternative names for the command |
| `syntax` | String | Usage syntax (e.g., `'ping'` or `'ban (user) [reason]'`) |
| `example` | String | Example usage (e.g., `'ban @user spamming'`) |
| `permission` | String | Required permission (e.g., `'Administrator'`, `'Manage Messages'`) |
| `cooldowns` | Number | Cooldown in seconds (default: 3) |

### Help Display for Normal Commands

When you run `!help ping`, the bot displays:

```
╔═══════════════════════════════════╗
║ Command: ping                      ║
╠═══════════════════════════════════╣
║ Shows bot's latency response times ║
║                                    ║
║ Aliases: ms, latency               ║
║ Parameters: n/a                    ║
║ Information: n/a                   ║
║                                    ║
║ Usage:                             ║
║ ```yaml                            ║
║ Syntax: !ping                      ║
║ Example: !ping                     ║
║ ```                                ║
╚═══════════════════════════════════╝
```

---

## Group Commands

Group commands have multiple subcommands, each performing a different action.

### Structure Example

```javascript
module.exports = {
  name: "prefix",
  aliases: ['setprefix'],
  description: `Manage server prefix`,
  permission: 'Administrator',
  isGroupCommand: true, // ← This marks it as a group command
  
  run: async (client, message, args) => {
    const subcommand = args[0]?.toLowerCase();
    
    // Default behavior (no subcommand)
    if (!subcommand) {
      const subcommandInfo = {
        description: 'Shows the current server prefix',
        usage: '{guildprefix}prefix',
        aliases: [],
        parameters: [],
        example: '{guildprefix}prefix'
      };
      
      // Show current prefix logic
      return embeds.info(message, `Your Server prefix: \`!\``);
    }
    
    // Subcommand: set
    if (subcommand === 'set') {
      const subcommandInfo = {
        description: 'Sets a new prefix for the server',
        usage: '{guildprefix}prefix set [prefix]',
        aliases: [],
        parameters: ['prefix'],
        example: '{guildprefix}prefix set ?'
      };
      
      // Set prefix logic
      return handleSetPrefix(message, args[1]);
    }
    
    // Subcommand: remove (with aliases)
    if (subcommand === 'remove' || subcommand === 'reset' || subcommand === 'default') {
      const subcommandInfo = {
        description: 'Removes the custom prefix and resets to default',
        usage: '{guildprefix}prefix remove',
        aliases: ['reset', 'default'],
        parameters: [],
        example: '{guildprefix}prefix remove'
      };
      
      // Remove prefix logic
      return handleRemovePrefix(message);
    }
  }
}
```

### Key Differences from Normal Commands

1. **`isGroupCommand: true`** - Marks the command as having subcommands
2. **`subcommandInfo` objects** - Each subcommand block includes metadata for help display
3. **Conditional logic** - Uses `if` statements or `switch` cases to handle different subcommands

### SubcommandInfo Object

Each subcommand should have a `subcommandInfo` object with these properties:

```javascript
const subcommandInfo = {
  description: 'What this subcommand does',
  usage: '{guildprefix}command subcommand [required] (optional)',
  aliases: ['alt1', 'alt2'], // Alternative names for this subcommand
  parameters: ['param1', 'param2'], // List of parameters
  example: '{guildprefix}command subcommand example'
};
```

**Note:** `{guildprefix}` is automatically replaced with the server's actual prefix.

### Help Display for Group Commands

When you run `!help prefix`, the bot displays **paginated help**:

#### Page 1: Overview
```
╔═══════════════════════════════════╗
║ Group Command: prefix              ║
╠═══════════════════════════════════╣
║ Manage server prefix               ║
║                                    ║
║ Aliases: setprefix                 ║
║ Permission: Administrator          ║
║                                    ║
║ Usage:                             ║
║ ```yaml                            ║
║ Syntax: !prefix (subcommand) <args>║
║ ```                                ║
║                                    ║
║ Page 1/4 (3 entries) • Module: prefix ║
╚═══════════════════════════════════╝
[◀️] [❌] [▶️]  ← Navigation buttons
```

#### Page 2: First Subcommand
```
╔═══════════════════════════════════╗
║ Command: prefix (default)          ║
╠═══════════════════════════════════╣
║ Shows the current server prefix    ║
║                                    ║
║ Aliases: n/a                       ║
║ Permission: Administrator          ║
║                                    ║
║ Usage:                             ║
║ ```yaml                            ║
║ Syntax: !prefix                    ║
║ Example: !prefix                   ║
║ ```                                ║
║                                    ║
║ Page 2/4 (3 entries) • Module: prefix ║
╚═══════════════════════════════════╝
[◀️] [❌] [▶️]
```

### Viewing Specific Subcommands

You can jump directly to a specific subcommand:

```
!help prefix set      # Shows only the "set" subcommand page
!help remind remove   # Shows only the "remove" subcommand page
```

This displays the subcommand page **without pagination buttons**.

---

## How Help Detection Works

The help system uses multiple utilities to parse and display command information:

### 1. Subcommand Detection (`utils/subcommandParser.js`)

```javascript
function hasSubcommands(command) {
  return command.isGroupCommand === true;
}
```

Checks if a command has the `isGroupCommand: true` flag.

### 2. Subcommand Parsing

The parser reads the command file's source code and extracts `subcommandInfo` objects using regex:

```javascript
// Matches patterns like:
if (args[0] === 'add') {
  const subcommandInfo = {
    description: '...',
    usage: '...',
    // ...
  };
}
```

It also detects:
- **Aliases in conditionals:** `if (subcommand === 'remove' || subcommand === 'rm')`
- **Switch case statements:** `case 'add': case 'create':`

### 3. Help Embed Builder (`utils/helpEmbedBuilder.js`)

Creates three types of embeds:

- **`createParentCommandPage()`** - Overview page for group commands
- **`createSubcommandPage()`** - Individual subcommand pages
- **`createTraditionalEmbed()`** - Single embed for normal commands

### 4. Pagination (`core/buttons.js`)

Handles navigation buttons (◀️ ❌ ▶️) for multi-page help displays.

---

## Auto-Help Feature

Commands can automatically show help when used incorrectly.

### Using `runHelpCommand()`

```javascript
const { runHelpCommand } = require('../../utils/commandProcessor');

// In your command logic:
if (!args[0]) {
  return runHelpCommand(message, 'commandname');
}
```

### Example from `commands/moderation/ban/ban.js`

```javascript
if (!args[0]) {
  return runHelpCommand(message, 'ban');
}
```

When a user runs `!ban` without arguments, the bot automatically shows `!help ban`.

### Using `InvalidUsageError`

```javascript
const { InvalidUsageError } = require('../../utils/commandProcessor');

// Throw this error anywhere in your command:
if (invalidInput) {
  throw new InvalidUsageError('commandname');
}
```

The command processor catches this error and automatically displays help.

### Auto-Help Property

Commands have an `autoHelp` property (default: `true`):

```javascript
module.exports = {
  name: "mycommand",
  autoHelp: true, // Can be set to false to disable
  run: async (client, message, args) => {
    // If this returns false, help is shown automatically
    if (!args[0]) return false;
    
    // Command logic
  }
}
```

---

## Creating Your Own Commands

### Normal Command Template

```javascript
module.exports = {
  name: "mycommand",
  aliases: ['mc', 'mycmd'],
  description: `Brief description of what this command does`,
  syntax: 'mycommand (required) [optional]',
  example: 'mycommand value',
  permission: 'Manage Messages', // Optional
  cooldowns: 5, // Optional
  
  run: async (client, message, args) => {
    // Your command logic here
    
    // Show help if no arguments
    if (!args[0]) {
      const { runHelpCommand } = require('../../utils/commandProcessor');
      return runHelpCommand(message, 'mycommand');
    }
    
    // Do something
    message.channel.send('Command executed!');
  }
}
```

### Group Command Template

```javascript
const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');

module.exports = {
  name: "mygroup",
  aliases: ['mg'],
  description: `Manage something with multiple actions`,
  permission: 'Administrator',
  isGroupCommand: true,
  
  run: async (client, message, args) => {
    const subcommand = args[0]?.toLowerCase();
    
    // No subcommand - show default behavior
    if (!subcommand) {
      const subcommandInfo = {
        description: 'Shows current settings',
        usage: '{guildprefix}mygroup',
        aliases: [],
        parameters: [],
        example: '{guildprefix}mygroup'
      };
      
      return embeds.info(message, 'Current settings: ...');
    }
    
    // Subcommand: add
    if (subcommand === 'add' || subcommand === 'create') {
      const subcommandInfo = {
        description: 'Add a new item',
        usage: '{guildprefix}mygroup add [item]',
        aliases: ['create'],
        parameters: ['item'],
        example: '{guildprefix}mygroup add something'
      };
      
      if (!args[1]) {
        return runHelpCommand(message, 'mygroup');
      }
      
      // Add logic here
      return embeds.success(message, `Added ${args[1]}`);
    }
    
    // Subcommand: remove
    if (subcommand === 'remove' || subcommand === 'delete' || subcommand === 'rm') {
      const subcommandInfo = {
        description: 'Remove an item',
        usage: '{guildprefix}mygroup remove [item]',
        aliases: ['delete', 'rm'],
        parameters: ['item'],
        example: '{guildprefix}mygroup remove something'
      };
      
      if (!args[1]) {
        return runHelpCommand(message, 'mygroup');
      }
      
      // Remove logic here
      return embeds.success(message, `Removed ${args[1]}`);
    }
    
    // Subcommand: list
    if (subcommand === 'list' || subcommand === 'show') {
      const subcommandInfo = {
        description: 'List all items',
        usage: '{guildprefix}mygroup list',
        aliases: ['show'],
        parameters: [],
        example: '{guildprefix}mygroup list'
      };
      
      // List logic here
      return embeds.info(message, 'Items: ...');
    }
    
    // Invalid subcommand
    return runHelpCommand(message, 'mygroup');
  }
}
```

---

## Best Practices

### 1. Always Include SubcommandInfo

Even if the parser can extract some info, explicitly defining `subcommandInfo` ensures accurate help display.

### 2. Use Consistent Naming

- Use lowercase for subcommand names
- Keep aliases short and intuitive
- Use common patterns: `add/create`, `remove/delete/rm`, `list/show`

### 3. Handle Missing Arguments

Always check for required arguments and show help when missing:

```javascript
if (!args[1]) {
  return runHelpCommand(message, 'commandname');
}
```

### 4. Use {guildprefix} Placeholder

In `usage` and `example` fields, use `{guildprefix}` instead of hardcoding `!`:

```javascript
usage: '{guildprefix}command subcommand [arg]'
// Becomes: !command subcommand [arg]
// Or: ?command subcommand [arg] (if server uses ?)
```

### 5. Document Parameters Clearly

Use standard notation:
- `[required]` - Required parameter
- `(optional)` - Optional parameter
- `<choice1|choice2>` - Choose one option

### 6. Test Your Help Display

After creating a command, test it:

```
!help mycommand           # View help
!mycommand                # Should show help if no args required
!help mygroup             # View paginated help
!help mygroup add         # View specific subcommand
```

---

## Summary

- **Normal commands** use a simple structure with `name`, `description`, `syntax`, and `example`
- **Group commands** use `isGroupCommand: true` and include `subcommandInfo` objects for each subcommand
- The help system automatically parses command files and creates paginated displays
- Use `runHelpCommand()` to show help when commands are used incorrectly
- The `{guildprefix}` placeholder adapts to each server's custom prefix

This system makes it easy for users to discover and learn how to use commands, while keeping command files organized and maintainable.
