const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, checkSelfAction, checkBotAction, checkUserMemberHierarchy, checkBotMemberHierarchy } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { findUser } = require('../../../handlers/finder');
const webhookLogger = require('../../../utils/webhookLogger');
const logger = require('../../../utils/logger');
const { getService } = require('../../../database/services');

module.exports = {
  name: "imute",
  aliases: ['imgmute', 'imagemute'],
  description: `revoke someone's attachment/embed perms in this channel`,
  syntax: 'imute [user] (reason)',
  example: 'imute @vwsn spam',
  permission: 'moderate_members',
  run: async(client, message, args) => {
    const guildService = getService('guild');

    // Permission checks first
    if (!hasDiscordPermission(message, PermissionFlagsBits.ModerateMembers, 'Moderate Members')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return embeds.deny(message, 'I need **Manage Channels** permission to use this command');
    }

    // Check if user provided input
    if (!args[0]) {
      return runHelpCommand(message, 'imute');
    }

    // Use universal user finder
    const userResult = await findUser(message.guild, args[0], client);

    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }

    if (userResult.isGlobal) {
      return embeds.deny(message, 'User is not in this server');
    }

    const user = userResult.user;
    let reason = args.slice(1).join(" ");
    if (!reason) reason = 'reason';

    // Self-action check
    if (!checkSelfAction(message, user, 'image mute')) return;

    // Bot-action check
    if (!checkBotAction(message, user)) return;

    // Hierarchy checks
    if (!checkUserMemberHierarchy(message, user)) return;
    if (!checkBotMemberHierarchy(message, user)) return;

    try {
      // Check if user already has image mute permissions removed in this channel
      const currentOverrides = message.channel.permissionOverwrites.cache.get(user.id);
      if (currentOverrides?.deny?.has(PermissionFlagsBits.EmbedLinks) && currentOverrides?.deny?.has(PermissionFlagsBits.AttachFiles)) {
        return embeds.warn(message, `**${user.user.username}** is already image muted in this channel`);
      }

      // Remove image permissions for this channel only
      await message.channel.permissionOverwrites.edit(user, {
        EmbedLinks: false,
        AttachFiles: false
      }, { reason: `Image muted by ${message.author.tag}: ${reason}` });

      embeds.success(message, `**${user.user.tag}** has been **image muted** in this channel for ${reason}`);

      // Add to moderation history and log action asynchronously (don't wait)
      Promise.allSettled([
        guildService.addModerationCase(
          message.guild.id,
          user.user.id,
          message.author.id,
          'imute',
          reason
        ),
        logModerationAction('imute', message.author, user.user, reason, message.guild)
      ]).catch(() => {}); // Silent fail for background tasks

    } catch (error) {
      logger.webhook.error(error, message);
      embeds.deny(message, 'An error occurred while trying to image mute this user');
    }
  }
}

async function logModerationAction(action, executor, target, reason, guild) {
  try {
    const embed = webhookLogger.createModeratorLog({
      action: action,
      executor: executor,
      target: target,
      reason: reason,
      guild: guild
    });

    await webhookLogger.sendLog(guild.id, 'moderator', embed);
  } catch (error) {
    logger.webhook.error(error, 'Moderation Action Logging', {
      command: `${action} logging`,
      args: `Target: ${target?.tag || 'Unknown'}, Reason: ${reason}`,
      user: executor,
      guild: guild
    });
  }
}