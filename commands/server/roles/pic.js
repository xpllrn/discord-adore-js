const { PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, checkSelfAction, checkBotAction } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { findUser } = require('../../../handlers/finder');

module.exports = {
  name: "pic",
  description: "toggle user pic permissions (ability to send images/embeds) in current channel",
  syntax: 'pic (user)',
  example: 'pic @vwsn',
  permission: "Manage Channels",
  run: async(client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return embeds.deny(message, 'I need **Manage Channels** permission to use this command');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'pic');
    }

    // Use universal user finder
    const userResult = await findUser(message.guild, args[0], client);

    if (!userResult.found) {
      return embeds.warn(message, userResult.error);
    }

    // For pic command, we need a guild member, not a global user
    if (userResult.isGlobal) {
      return embeds.warn(message, 'User is not in this server');
    }

    const targetMember = userResult.user;

    if (!checkSelfAction(message, targetMember, 'toggle pic permissions for')) return;
    if (!checkBotAction(message, targetMember)) return;

    try {
      const channel = message.channel;

      // Check if user already has pic perms in this channel
      const overwrite = channel.permissionOverwrites.cache.get(targetMember.id);
      const hasPicPerms = overwrite?.allow?.has('AttachFiles') || overwrite?.allow?.has('EmbedLinks');

      if (hasPicPerms) {
        // Remove pic permissions
        await channel.permissionOverwrites.delete(targetMember.id);
        return embeds.success(message, `**${targetMember.user.tag}** can no longer send images/embeds in ${channel}`);
      } else {
        // Grant pic permissions
        await channel.permissionOverwrites.create(targetMember, {
          AttachFiles: true,
          EmbedLinks: true
        });
        return embeds.success(message, `**${targetMember.user.tag}** can now send images/embeds in ${channel}`);
      }

    } catch (error) {
      return embeds.warn(message, 'An error occurred while toggling pic permissions.');
    }
  }
}
