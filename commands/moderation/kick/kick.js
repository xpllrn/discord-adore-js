const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, checkSelfAction, checkBotAction, checkUserMemberHierarchy, checkBotMemberHierarchy, checkDiscordActionable } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { getService } = require('../../../database/services');
const { findUser } = require('../../../handlers/finder');
const webhookLogger = require('../../../utils/webhookLogger');
const logger = require('../../../utils/logger');

module.exports = {
  name: "kick",
  aliases: ['boot'],
  description: 'Kicks the mentioned user from the server',
  syntax: 'kick [user] (reason)',
  example: 'kick @vwsn spam',
  permission: 'kick_members',
  run: async(client, message, args) => {
    const guildService = getService('guild');

    // Permission checks first
    if (!await hasDiscordPermission(message, PermissionFlagsBits.KickMembers, 'Kick Members')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
      return embeds.deny(message, 'I need **Kick Members** permission to use this command');
    }

    // Check if user provided input
    if (!args[0]) {
      return runHelpCommand(message, 'kick');
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
    if (!reason) reason = 'reasons';

    if (!checkSelfAction(message, user, 'kick')) return;
    if (!checkBotAction(message, user)) return;

    if (!checkUserMemberHierarchy(message, user)) return;
    if (!checkBotMemberHierarchy(message, user)) return;

    // Check if Discord allows the kick action
    if (!checkDiscordActionable(message, user, 'kick')) return;

    // Perform the kick
    try {
      await user.kick(`${reason} | Kicked by: ${message.author.tag}`);

      // Add to moderation history
      let caseNumber = null;
      try {
        const moderationCase = await guildService.addModerationCase(
          message.guild.id,
          user.user.id,
          message.author.id,
          'kick',
          reason
        );
        caseNumber = moderationCase.caseId;
      } catch (historyError) {
        // Don't fail the command if history logging fails
      }

      embeds.success(message, `**${user.user.tag}** has been **kicked** for ${reason}`);

      // Send DM to user
      await webhookLogger.sendModeratorDM({
        target: user.user,
        action: 'kick',
        executor: message.author,
        reason,
        guild: message.guild
      });

      // Log the kick action
      await logModerationAction('kick', message.author, user.user, reason, message.guild, caseNumber);
    } catch (error) {
      logger.webhook.error(error, 'Kick Command', {
        user: message.author,
        guild: message.guild,
        channel: message.channel,
        command: 'kick',
        args: `${user.user.tag} - ${reason}`
      });
      throw error;
    }
  }
}

async function logModerationAction(action, executor, target, reason, guild, caseNumber = null) {
  try {
    const embed = webhookLogger.createModeratorLog({
      action: action,
      executor: executor,
      target: target,
      reason: reason,
      caseNumber: caseNumber,
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
