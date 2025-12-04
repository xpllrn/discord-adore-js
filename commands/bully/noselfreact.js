const { PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { hasDiscordPermission } = require('../../utils/permissions');
const { runHelpCommand } = require('../../utils/commandProcessor');

module.exports = {
  name: "nsr",
  aliases: ["noselfreact"],
  description: "Prevent members from reacting to their own messages",
  permission: "manage_guild",
  syntax: 'nsr [subcommand] (user)',
  example: 'nsr on',
  isGroupCommand: true,

  subcommands: {
    on: {
      name: 'on',
      aliases: ['enable'],
      description: 'Enable no self-react',
      syntax: '{guildprefix}nsr on',
      parameters: [],
      example: '{guildprefix}nsr on',

      handler: async (client, message, args, guildService) => {
        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (guildData.NoSelfReact?.enabled) {
          return embeds.warn(message, 'No self-react is already **enabled**');
        }

        await guildService.updateGuildData(message.guild.id, {
          'NoSelfReact.enabled': true
        });

        return embeds.success(message, '**No selfreact** has been **enabled**');
      }
    },

    off: {
      name: 'off',
      aliases: ['disable'],
      description: 'Disable no self-react',
      syntax: '{guildprefix}nsr off',
      parameters: [],
      example: '{guildprefix}nsr off',

      handler: async (client, message, args, guildService) => {
        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (!guildData.NoSelfReact?.enabled) {
          return embeds.warn(message, 'No self-react is already **disabled**');
        }

        await guildService.updateGuildData(message.guild.id, {
          'NoSelfReact.enabled': false
        });

        return embeds.success(message, '**No selfreact** has been **disabled**');
      }
    },

    bypass: {
      name: 'bypass',
      aliases: [],
      description: 'Toggle bypass for a user',
      syntax: '{guildprefix}nsr bypass [user]',
      parameters: ['user'],
      example: '{guildprefix}nsr bypass @user',

      handler: async (client, message, args, guildService) => {
        const targetUser = message.mentions.users.first();
        
        if (!targetUser) {
          return embeds.deny(message, 'Please **mention a user** to bypass');
        }

        const guildData = await guildService.ensureGuildData(message.guild.id);
        const bypassUsers = guildData.NoSelfReact?.bypassUsers || [];
        const userIndex = bypassUsers.indexOf(targetUser.id);

        if (userIndex > -1) {
          bypassUsers.splice(userIndex, 1);
          await guildService.updateGuildData(message.guild.id, {
            'NoSelfReact.bypassUsers': bypassUsers
          });

          return embeds.success(message, `Removed ${targetUser} from **bypass list**`);
        } else {
          bypassUsers.push(targetUser.id);
          await guildService.updateGuildData(message.guild.id, {
            'NoSelfReact.bypassUsers': bypassUsers
          });

          return embeds.success(message, `Added ${targetUser} to **bypass list**`);
        }
      }
    }
  },

  run: async (client, message, args) => {
    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Server')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return embeds.deny(message, 'I need **Manage Messages** permission to remove self-reactions');
    }

    const guildService = getService('guild');

    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return runHelpCommand(message, 'nsr');
    }

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'nsr');
  }
};
