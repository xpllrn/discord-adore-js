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
  run: async (client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Server')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return embeds.deny(message, 'I need **Manage Messages** permission to remove self-reactions');
    }

    const guildService = getService('guild');

    if (!args[0]) {
      return runHelpCommand(message, 'nsr');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'on': {
        const subcommandInfo = {
          description: 'Enable no self-react',
          syntax: '{guildprefix}nsr on',
          aliases: [],
          example: '{guildprefix}nsr on'
        };
        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (guildData.NoSelfReact?.enabled) {
          return embeds.warn(message, 'No self-react is already **enabled**');
        }

        await guildService.updateGuildData(message.guild.id, {
          'NoSelfReact.enabled': true
        });

        return embeds.success(message, '**No selfreact** has been **enabled**');
      }

      case 'off': {
        const subcommandInfo = {
          description: 'Disable no self-react',
          syntax: '{guildprefix}nsr off',
          aliases: [],
          example: '{guildprefix}nsr off'
        };
        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (!guildData.NoSelfReact?.enabled) {
          return embeds.warn(message, 'No self-react is already **disabled**');
        }

        await guildService.updateGuildData(message.guild.id, {
          'NoSelfReact.enabled': false
        });

        return embeds.success(message, '**No selfreact** has been **disabled**');
      }

      case 'bypass': {
        const subcommandInfo = {
          description: 'Toggle bypass for a user',
          syntax: '{guildprefix}nsr bypass [user]',
          aliases: [],
          example: '{guildprefix}nsr bypass @user'
        };
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

      default: {
        return runHelpCommand(message, 'nsr');
      }
    }
  }
};
