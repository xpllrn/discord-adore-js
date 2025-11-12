# Command Structure Standards

This document defines the standard structure for all commands in the bot to ensure consistency and proper help command functionality.

## Table of Contents
- [Overview](#overview)
- [Single Commands](#single-commands)
- [Group Commands](#group-commands)
- [Help Command Display](#help-command-display)
- [Best Practices](#best-practices)

---

## Overview

There are **two types** of commands:

1. **Single Commands** - Commands that perform one action (e.g., `daily`, `invite`, `clearsnipe`)
2. **Group Commands** - Commands with multiple subcommands (e.g., `antinuke`, `levels`, `autorole`)

---

## Single Commands

Single commands perform one specific action and have a simple structure.

### Structure

```javascript
module.exports = {
  name: "commandname",
  aliases: ['alias1', 'alias2'],
  description: 'Brief description of what this command does',
  syntax: 'commandname [required] (optional)',
  example: 'commandname value',
  permission: 'Permission Name', // optional - e.g., 'Manage Guild', 'Administrator'
  cooldowns: 5, // optional - cooldown in seconds (default: 3)
  run: async (client, message, args) => {
    // Command logic here
  }
};
```

### Example: Daily Command

```javascript
module.exports = {
  name: "daily",
  aliases: ['claim'],
  description: 'Claim your daily coins with streak bonuses',
  syntax: 'daily',
  example: 'daily',
  run: async (client, message, args) => {
    // Implementation
  }
};
```

### Help Display for Single Commands

```
Command: daily
Claim your daily coins with streak bonuses

Aliases
claim

Permission
n/a

Usage
```
Syntax: ,daily
Example: ,daily
```
```

---

## Group Commands

Group commands contain multiple subcommands and require special structure for proper help display.

### Structure

```javascript
module.exports = {
  name: "commandname",
  aliases: ['alias1', 'alias2'],
  description: 'Brief description of the command group',
  permission: 'Permission Name', // optional - applies to all subcommands
  isGroupCommand: true, // REQUIRED for group commands
  run: async (client, message, args) => {
    if (!args[0]) {
      return runHelpCommand(message, 'commandname');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'subcommand1': {
        const subcommandInfo = {
          description: 'What this subcommand does',
          usage: '{guildprefix}commandname subcommand1 [param]',
          aliases: ['alias'],
          example: '{guildprefix}commandname subcommand1 value'
        };
        return await handleSubcommand1(message, args);
      }
      
      case 'subcommand2': {
        const subcommandInfo = {
          description: 'What this subcommand does',
          usage: '{guildprefix}commandname subcommand2',
          aliases: [],
          example: '{guildprefix}commandname subcommand2'
        };
        return await handleSubcommand2(message, args);
      }
      
      default:
        return runHelpCommand(message, 'commandname');
    }
  }
};
```

### Important Notes

1. **`isGroupCommand: true`** - MUST be set for commands with subcommands
2. **`subcommandInfo` object** - MUST be defined for each subcommand case
3. **No `parameters` field** - This field is NOT used and should NOT be included
4. **`{guildprefix}` placeholder** - Use this in usage/example strings, it will be replaced with the actual prefix

### SubcommandInfo Fields

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `description` | Yes | Brief description of what the subcommand does | `'Add a welcome message'` |
| `usage` | Yes | Full command syntax with parameters | `'{guildprefix}welcome add [channel] [message]'` |
| `aliases` | Yes | Array of alternative names (use `[]` if none) | `['create', 'new']` |
| `example` | Yes | Example usage with actual values | `'{guildprefix}welcome add #general Welcome!'` |

### Example: Welcome Command

```javascript
module.exports = {
  name: "welcome",
  aliases: ['welc'],
  description: 'Set up a welcome message for when new members join',
  permission: 'Manage Guild',
  isGroupCommand: true,
  run: async (client, message, args) => {
    if (!args[0]) {
      return runHelpCommand(message, 'welcome');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'add': {
        const subcommandInfo = {
          description: 'Add or update a welcome message for a channel',
          usage: '{guildprefix}welcome add [channel] [message]',
          aliases: [],
          example: '{guildprefix}welcome add #general Welcome {user.mention}!'
        };
        return await handleAdd(message, args);
      }
      
      case 'remove': {
        const subcommandInfo = {
          description: 'Remove the welcome message',
          usage: '{guildprefix}welcome remove',
          aliases: ['delete'],
          example: '{guildprefix}welcome remove'
        };
        return await handleRemove(message, args);
      }
      
      default:
        return runHelpCommand(message, 'welcome');
    }
  }
};
```

### Help Display for Group Commands

**Page 1 - Parent Command:**
```
Group Command: welcome
Set up a welcome message for when new members join

Aliases
welc

Permission
Manage Guild

Usage
```
Syntax: ,welcome (subcommand) <args>
```
```

**Page 2 - Subcommand:**
```
Command: welcome add
Add or update a welcome message for a channel

Aliases
n/a

Permission
Manage Guild

Usage
```
Syntax: ,welcome add [channel] [message]
Example: ,welcome add #general Welcome {user.mention}!
```
```

---

## Help Command Display

The help command automatically detects command type and displays appropriate format:

### For Single Commands
- Shows: Title, Description, Aliases, Permission, Usage (Syntax + Example)
- Single page embed

### For Group Commands
- Shows: Parent page + individual subcommand pages
- Paginated with buttons
- Users can navigate between subcommands
- Can request specific subcommand: `help commandname subcommand`

---

## Best Practices

### ✅ DO

- Use `isGroupCommand: true` for all commands with subcommands
- Include `subcommandInfo` for every subcommand case
- Use `{guildprefix}` placeholder in usage/example strings
- Keep descriptions concise and clear
- Use consistent parameter notation:
  - `[required]` - Required parameter
  - `(optional)` - Optional parameter
  - `<choice1|choice2>` - Choose one option
- Return `runHelpCommand(message, 'commandname')` for invalid usage
- Use empty array `[]` for aliases if none exist

### ❌ DON'T

- Don't include `parameters` field in `subcommandInfo` (not used)
- Don't forget `isGroupCommand: true` flag for group commands
- Don't hardcode prefix in usage/example strings
- Don't use inconsistent parameter notation
- Don't leave out `subcommandInfo` for any subcommand

### Parameter Notation Guide

```javascript
// Required parameter
usage: '{guildprefix}ban [user] [reason]'

// Optional parameter
usage: '{guildprefix}purge (amount)'

// Multiple options
usage: '{guildprefix}levels messagemode <none|channel|context>'

// Mixed
usage: '{guildprefix}welcome add [channel] (message)'
```

---

## Validation Script

Run the standardization script to check all commands:

```bash
node scripts/standardize-commands.js
```

This will:
- Find all commands with `subcommandInfo`
- Remove any unused `parameters` fields
- Report commands missing `isGroupCommand` flag
- Show which files were modified

---

## Migration Checklist

When updating an existing command to the standard:

- [ ] Add `isGroupCommand: true` if command has subcommands
- [ ] Ensure all subcommand cases have `subcommandInfo` object
- [ ] Remove `parameters` field from all `subcommandInfo` objects
- [ ] Use `{guildprefix}` placeholder in usage/example strings
- [ ] Verify aliases array exists (use `[]` if empty)
- [ ] Test help command display: `help commandname`
- [ ] Test specific subcommand help: `help commandname subcommand`

---

## Questions?

If you're unsure about command structure:
1. Check existing standardized commands (e.g., `antinuke.js`, `levels.js`, `autorole.js`)
2. Run the validation script
3. Test with the help command

---

**Last Updated:** 2024
**Maintained By:** Development Team
