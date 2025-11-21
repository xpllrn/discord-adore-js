const { PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { hasDiscordPermission } = require('../../utils/permissions');

module.exports = {
  name: "nsr",
  aliases: ["noselfreact"],
  description: "Prevent members from reacting to their own messages",
  permission: "Manage Server",
  run: async (client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Server')) return;

    const guildService = getService('guild');
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand) {
      return embeds.warn(message, 'Use: `nsr on`, `nsr off`, or `nsr bypass @user`');
    }

    if (subcommand === 'on') {
      const guildData = await guildService.ensureGuildData(message.guild.id);
      
      if (guildData.NoSelfReact?.enabled) {
        return embeds.warn(message, 'No self-react is already **enabled**');
      }

      await guildService.updateGuildData(message.guild.id, {
        'NoSelfReact.enabled': true
      });

      return embeds.success(message, 'No self-react has been **enabled**');
    }

    if (subcommand === 'off') {
      const guildData = await guildService.ensureGuildData(message.guild.id);
      
      if (!guildData.NoSelfReact?.enabled) {
        return embeds.warn(message, 'No self-react is already **disabled**');
      }

      await guildService.updateGuildData(message.guild.id, {
        'NoSelfReact.enabled': false
      });

      return embeds.success(message, 'No self-react has been **disabled**');
    }

    if (subcommand === 'bypass') {
      const targetUser = message.mentions.users.first();
      
      if (!targetUser) {
        return embeds.deny(message, 'Please mention a user to toggle bypass');
      }

      const guildData = await guildService.ensureGuildData(message.guild.id);
      const bypassUsers = guildData.NoSelfReact?.bypassUsers || [];
      const userIndex = bypassUsers.indexOf(targetUser.id);

      if (userIndex > -1) {
        bypassUsers.splice(userIndex, 1);
        await guildService.updateGuildData(message.guild.id, {
          'NoSelfReact.bypassUsers': bypassUsers
        });

        return embeds.success(message, `Removed ${targetUser} from bypass list`);
      } else {
        bypassUsers.push(targetUser.id);
        await guildService.updateGuildData(message.guild.id, {
          'NoSelfReact.bypassUsers': bypassUsers
        });

        return embeds.success(message, `Added ${targetUser} to bypass list`);
      }
    }

    return embeds.deny(message, 'Invalid subcommand. Use: `nsr on`, `nsr off`, or `nsr bypass @user`');
  }
};
