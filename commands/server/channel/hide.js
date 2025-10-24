const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { findRole, findChannel } = require('../../../handlers/finder');

module.exports = {
  name: "hide",
  aliases: ['hidechannel'],
  description: 'hides the channel for default/selected role',
  usage: '{guildprefix}hide\n{guildprefix}hide @role\n{guildprefix}hide #channel @role',
  permission: 'Manage Channels',
  run: async(client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return embeds.deny(message, 'I need **Manage Channels** permission to use this command');
    }

    // Check if command is used in a thread
    if (message.channel.isThread()) {
      return embeds.warn(message, 'Threads cannot be hidden. Use the command in the parent channel.');
    }

    let targetChannel = message.channel;
    let targetRole = null;

    if (args.length === 0) {
      targetRole = message.guild.roles.everyone;
    } else if (args.length === 1) {
      const roleResult = findRole(message.guild, args[0]);
      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }
      targetRole = roleResult.role;
    } else if (args.length === 2) {
      const channelMention = args[0].match(/^<#(\d+)>$/);
      if (channelMention) {
        const channelResult = findChannel(message.guild, channelMention[1]);
        if (!channelResult.found) {
          return embeds.deny(message, channelResult.error || `Channel with ID ${channelMention[1]} not found`);
        }
        targetChannel = channelResult.channel;
      } else {
        return embeds.deny(message, "Please provide a **valid channel mention** (e.g., #general)");
      }

      const roleResult = findRole(message.guild, args[1]);
      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }
      targetRole = roleResult.role;
    } else {
      return runHelpCommand(message, 'hide');
    }

    const currentPerms = targetChannel.permissionsFor(targetRole);
    if (currentPerms && !currentPerms.has(PermissionFlagsBits.ViewChannel)) {
      const roleText = targetRole.id === message.guild.id ? "@everyone" : `**${targetRole.name}**`;
      return embeds.warn(message, `**#${targetChannel.name}** is already **hidden** for ${roleText}`);
    }

    try {
      await targetChannel.permissionOverwrites.edit(targetRole, {
        ViewChannel: false,
      });

      return message.react('🙈');
    } catch (error) {
      return embeds.deny(message, "An error occurred while trying to **hide** the channel");
    }
  }
}
