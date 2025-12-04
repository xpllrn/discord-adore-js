# Subcommand Pattern Guide

This document explains the recommended pattern for defining subcommands in group commands.

## The Pattern: Subcommands Object with Handlers

Each subcommand is defined as an object with its info AND handler together:

```javascript
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { getService } = require('@services');

module.exports = {
  name: "commandname",
  aliases: ['cmd'],
  description: 'Command description',
  syntax: 'commandname [subcommand] (parameters)',
  example: 'commandname add something',
  permission: 'manage_channels',
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: ['create'],
      description: 'Add a new item',
      syntax: '{guildprefix}commandname add [item]',
      parameters: ['item'],
      example: '{guildprefix}commandname add myitem',

      handler: async (client, message, args, guildService) => {
        // ALL the add logic here
        const item = args[0];
        if (!item) {
          return runHelpCommand(message, 'commandname');
        }
        // ... rest of logic
        return embeds.success(message, `Added **${item}**`);
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete', 'rm'],
      description: 'Remove an item',
      syntax: '{guildprefix}commandname remove [item]',
      parameters: ['item'],
      example: '{guildprefix}commandname remove myitem',

      handler: async (client, message, args, guildService) => {
        // ALL the remove logic here
        const item = args[0];
        if (!item) {
          return runHelpCommand(message, 'commandname');
        }
        // ... rest of logic
        return embeds.success(message, `Removed **${item}**`);
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'List all items',
      syntax: '{guildprefix}commandname list',
      parameters: [],
      example: '{guildprefix}commandname list',

      handler: async (client, message, args, guildService) => {
        // ALL the list logic here
        return embeds.info(message, 'Listing items...');
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');

    // Add permission check if needed
    // if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;

    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return runHelpCommand(message, 'commandname');
    }

    // Find matching subcommand (checks name and aliases)
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'commandname');
  }
};
```

## Required Fields for Each Subcommand

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Primary subcommand name |
| `aliases` | string[] | Alternative names (use `[]` if none) |
| `description` | string | What the subcommand does |
| `syntax` | string | Usage with `{guildprefix}` placeholder |
| `parameters` | string[] | Parameter list (use `[]` if none) |
| `example` | string | Example with `{guildprefix}` placeholder |
| `handler` | async function | The actual logic |

## Handler Function Signature

```javascript
handler: async (client, message, args, guildService) => {
  // client - Discord client
  // message - The message object
  // args - Arguments AFTER the subcommand (already sliced)
  // guildService - Pre-initialized guild service
}
```

## Benefits

- ✅ Info + logic together (no duplication)
- ✅ Help system reads directly (fast, no file parsing)
- ✅ Single source of truth
- ✅ Easy to see all subcommands at top
- ✅ No linter warnings
- ✅ Clean `run` function - just routes to handlers

## Commands to Migrate

- [x] `commands/server/automation/alias.js`
- [x] `commands/server/automation/autoreact.js`
- [x] `commands/server/automation/message.js`
- [x] `commands/server/features/ticket.js`
- [x] `commands/server/features/voicemaster.js`
- [x] `commands/server/features/starboard.js`
- [x] `commands/server/features/giveaways.js`
- [x] `commands/server/features/confession.js`
- [x] `commands/server/features/count.js`
- [x] `commands/moderation/automod/filter.js`
- [x] `commands/moderation/ban/hardban.js`
- [x] `commands/moderation/history/history.js`
- [x] `commands/moderation/mute/mute.js`
- [x] `commands/moderation/purge/purge.js`
- [x] `commands/server/events/welcome.js`
- [x] `commands/server/events/leave.js`
- [x] `commands/server/levels/levels.js`
- [ ] `commands/server/protection/antiraid.js`
- [ ] `commands/server/protection/antinuke.js`
- [ ] `commands/server/protection/fakepermissions.js`
- [x] `commands/server/members/forcenick.js`
- [x] `commands/server/settings/settings.js`
- [x] `commands/server/settings/customize.js`
- [x] `commands/server/settings/logs.js`
- [x] `commands/server/settings/webhook.js`
- [x] `commands/server/roles/reactionrole.js`
- [x] `commands/server/roles/buttonrole.js`
- [x] `commands/server/roles/autorole.js`
- [x] `commands/server/roles/role.js`
- [x] `commands/server/roles/boostrole.js`
- [x] `commands/server/boost/boost.js`
- [x] `commands/music/spotify/spotify.js`
- [x] `commands/music/lastfm/fm.js`
- [x] `commands/utility/tools/note.js`
- [x] `commands/utility/tools/remind.js`
- [x] `commands/premium/selfprefix.js`
- [x] `commands/profiles/expressions/emoji.js`
- [x] `commands/profiles/expressions/sticker.js`
- [x] `commands/fun/random/blacktea.js`
- [x] `commands/core/prefix.js`
- [x] `commands/adore bio/about.js`
