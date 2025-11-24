const { PermissionFlagsBits } = require("discord.js");
const { checkSelfAction, checkBotAction, checkDiscordActionable } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { getService } = require('../../../database/services');
const { findUser } = require('../../../handlers/finder');
const webhookLogger = require('../../../utils/webhookLogger');
const logger = require('../../../utils/logger');

module.exports = {
  name: "unmute",
  aliases: ['untimeout', 'uto'],
  description: `remove timeout from a user using Discord's built-in timeout feature`,
  syntax: 'unmute [user] (reason)',
  example: 'unmute @vwsn appeal',
  permission: 'moderate_members',
  run: async (client, message, args) => {
    const guildService = getService('guild');

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return embeds.deny(message, 'I need **Moderate Members** permission to use this command');
    }

    // Check if user provided input
    if (!args[0]) {
      return runHelpCommand(message, 'unmute');
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

    // Check self action
    if (!checkSelfAction(message, user.user, 'unmute')) return;

    // Check bot action
    if (!checkBotAction(message, user.user)) return;

    // Check if user is actionable (hierarchy and Discord restrictions)
    if (!checkDiscordActionable(message, user, 'untimeout')) return;

    // Check if user is actually timed out
    if (!user.communicationDisabledUntil || user.communicationDisabledUntil <= new Date()) {
      return embeds.warn(message, `**${user.user.username}** is not timed out`);
    }

    const reason = args.slice(1).join(' ') || 'reasons';

    try {
      await user.timeout(null, reason); // null removes the timeout

      embeds.success(message, `**${user.user.username}** has been **unmuted** for ${reason}`);

      // Add to moderation history and log action asynchronously (don't wait)
      Promise.allSettled([
        guildService.addModerationCase(
          message.guild.id,
          user.user.id,
          message.author.id,
          'unmute',
          reason
        ),
        logModerationAction('untimeout', message.author, user.user, reason, message.guild)
      ]).catch(() => {}); // Silent fail for background tasks

    } catch (error) {
      return embeds.deny(message, 'Failed to remove timeout. Please check my permissions and role hierarchy.');
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
