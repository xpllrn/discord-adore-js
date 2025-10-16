const { PermissionFlagsBits } = require("discord.js");
const { hasDiscordPermission, checkSelfAction, checkBotAction, checkDiscordActionable } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { addModerationCase } = require('../../../database');
const { findUser } = require('../../../handlers/finder');
const webhookLogger = require('../../../utils/webhookLogger');
const ms = require('ms');

module.exports = {
  name: "mute",
  aliases: ['shh', 'timeout'],
  description: `timeout a user using Discord's built-in timeout feature`,
  usage: `{guildprefix}mute [user] [duration] [reason]
{guildprefix}mute @user 10m spam`,
  permission: 'Moderate Members',
  run: async(client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ModerateMembers, 'Moderate Members')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return embeds.deny(message, 'I need **Moderate Members** permission to use this command');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'mute');
    }

    let userResult;
    try {
      userResult = await findUser(message.guild, args[0], client);
    } catch (error) {
      return embeds.deny(message, 'An error occurred while searching for the user. Please try again.');
    }

    if (!userResult || typeof userResult !== 'object' || !userResult.found) {
      return embeds.deny(message, userResult?.error || 'User not found');
    }

    if (userResult.isGlobal) {
      return embeds.deny(message, 'User is not in this server');
    }

    const user = userResult.user;

    if (!checkSelfAction(message, user.user)) return;
    if (!checkBotAction(message, user.user)) return;
    if (!checkDiscordActionable(message, user, 'timeout')) return;

    if (user.communicationDisabledUntil && user.communicationDisabledUntil > new Date()) {
      return embeds.warn(message, `**${user.user.username}** is already timed out`);
    }

    let duration = ms('5m');
    let reason = 'reasons';

    if (args[1]) {
      const parsedDuration = ms(args[1]);
      if (parsedDuration && parsedDuration > 0) {
        const maxTimeout = ms('28d');
        duration = Math.min(parsedDuration, maxTimeout);
        reason = args.slice(2).join(' ') || 'reasons';
      } else {
        reason = args.slice(1).join(' ');
      }
    }

    try {
      await user.timeout(duration, reason);

      try {
        await addModerationCase(
          message.guild.id,
          user.user.id,
          message.author.id,
          'mute',
          reason,
          ms(duration, { long: true })
        );
      } catch (historyError) {

      }

      // Log the mute action
      await logModerationAction('timeout', message.author, user.user, reason, message.guild, ms(duration, { long: true }));

      return embeds.success(message, `**${user.user.username}** has been **muted** for ${ms(duration, { long: true })} for ${reason}`);

    } catch (error) {
      return embeds.deny(message, 'Failed to timeout user. Please check my permissions and role hierarchy.');
    }
  }
}

async function logModerationAction(action, executor, target, reason, guild, duration = null) {
  try {
    const embed = webhookLogger.createModeratorLog({
      action: action,
      executor: executor,
      target: target,
      reason: reason,
      duration: duration,
      guild: guild
    });

    await webhookLogger.sendLog(guild.id, 'moderator', embed);
  } catch (error) {
    // Send error to webhook instead of console
    if (guild.client?.errorLogger) {
      guild.client.errorLogger.log(error, 'Moderation Action Logging', {
        command: `${action} logging`,
        args: `Target: ${target?.tag || 'Unknown'}, Reason: ${reason}`,
        user: executor,
        guild: guild
      });
    }
  }
}
