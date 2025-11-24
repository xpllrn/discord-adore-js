const { PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { hasDiscordPermission } = require('../../utils/permissions');

module.exports = {
  name: "nsr",
  aliases: ["noselfreact"],
  description: "Prevent members from reacting to their own messages",
  permission: "manage_guild",
  isGroupCommand: true,
  run: async (client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Server')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return embeds.deny(message, 'I need **Manage Messages** permission to remove self-reactions');
    }

    const guildService = getService('guild');
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand) {
      return embeds.warn(message, 'Use: `nsr on`, `nsr off`, or `nsr bypass @user`');
    }

    if (subcommand === 'on') {
      const subcommandInfo = {
        description: 'Enable no self-react',
        usage: '{guildprefix}nsr on',
        aliases: [],
        parameters: [],
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

    if (subcommand === 'off') {
      const subcommandInfo = {
        description: 'Disable no self-react',
        usage: '{guildprefix}nsr off',
        aliases: [],
        parameters: [],
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

    if (subcommand === 'bypass') {
      const subcommandInfo = {
        description: 'Toggle bypass for a user',
        usage: '{guildprefix}nsr bypass [@user]',
        aliases: [],
        parameters: ['user'],
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

    return embeds.deny(message, 'Invalid subcommand. Use: `nsr on`, `nsr off`, or `nsr bypass @user`');
  }
};
