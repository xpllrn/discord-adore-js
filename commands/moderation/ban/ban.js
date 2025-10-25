const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, checkSelfAction, checkBotAction, checkUserMemberHierarchy, checkBotMemberHierarchy, checkDiscordActionable } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { getService } = require('../../../database/services');
const { findUser } = require('../../../handlers/finder');
const webhookLogger = require('../../../utils/webhookLogger');

module.exports = {
  name: "ban",
  aliases: ['deport', 'hackban', 'hban', 'hb'],
  description: 'ban the mentioned user from the server (works with user IDs for users not in server)',
  usage: '{guildprefix}ban [user]\n{guildprefix}ban [user] [reason]',
  permission: 'Ban Members',
  run: async(client, message, args) => {
    const moderationService = getService('moderation');

    if (!hasDiscordPermission(message, PermissionFlagsBits.BanMembers, 'Ban Members')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      return embeds.deny(message, 'I need **Ban Members** permission to use this command');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'ban');
    }

    let reason = args.slice(1).join(" ");
    if (!reason) reason = 'reasons';

    const userResult = await findUser(message.guild, args[0], client);

    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }

    const user = userResult.user;
    const isHardban = userResult.isGlobal;

    if (isHardban) {
      // Hardban - user is not in server, ban by ID
      if (!checkSelfAction(message, user, 'ban')) return;
      if (!checkBotAction(message, user)) return;

      try {
        await message.guild.members.ban(user.id, { reason: `${reason} | Hardban by: ${message.author.tag}` });

        let caseNumber = null;
        try {
          const moderationCase = await moderationService.addModerationCase(
            message.guild.id,
            user.id,
            message.author.id,
            'hardban',
            reason
          );
          caseNumber = moderationCase.caseId;
        } catch (historyError) {
          // Don't fail the command if history logging fails
        }

        embeds.success(message, `**${user.tag}** has been **hard banned** for ${reason}`);

        // Log the ban action
        await logModerationAction('ban', message.author, user, reason, message.guild, caseNumber);
      } catch (error) {
        embeds.deny(message, 'An error occurred while trying to hardban this user.');
      }
    } else {
      // Regular ban - user is in server
      if (!checkSelfAction(message, user, 'ban')) return;
      if (!checkBotAction(message, user)) return;
      if (!checkUserMemberHierarchy(message, user)) return;
      if (!checkBotMemberHierarchy(message, user)) return;
      if (!checkDiscordActionable(message, user, 'ban')) return;

      try {
        await user.ban({ reason: `${reason} | Banned by: ${message.author.tag}` });

        let caseNumber = null;
        try {
          const moderationCase = await moderationService.addModerationCase(
            message.guild.id,
            user.user.id,
            message.author.id,
            'ban',
            reason
          );
          caseNumber = moderationCase.caseId;
        } catch (historyError) {
          // Don't fail the command if history logging fails
        }

        embeds.success(message, `**${user.user.tag}** has been **banned** for ${reason}`);

        // Log the ban action
        await logModerationAction('ban', message.author, user.user, reason, message.guild, caseNumber);
      } catch (error) {
        embeds.deny(message, 'An error occurred while trying to ban this user.');
      }
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
