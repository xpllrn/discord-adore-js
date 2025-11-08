const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, checkSelfAction, checkBotAction } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { getService } = require('../../../database/services');
const webhookLogger = require('../../../utils/webhookLogger');
const logger = require('../../../utils/logger');

module.exports = {
  name: "unban",
  description: `unban the mentioned user from the server`,
  syntax: 'unban (user) (reason)',
  example: 'unban @vwsn appeal',
  permission: 'Ban Members',
  run: async(client, message, args) => {
    const moderationService = getService('moderation');

    // Permission checks first
    if (!hasDiscordPermission(message, PermissionFlagsBits.BanMembers, 'Ban Members')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      return embeds.deny(message, 'I need **Ban Members** permission to use this command');
    }

    // Check if user provided input
    if (!args[0]) {
      return runHelpCommand(message, 'unban');
    }

    try {
      // Fetch all banned users
      const bannedUsers = await message.guild.bans.fetch();

      let targetBan = null;
      const userInput = args[0].toLowerCase();

      // Try to find banned user by ID first
      if (/^\d+$/.test(userInput)) {
        targetBan = bannedUsers.get(userInput);
      }

      // If not found by ID, search by username or tag
      if (!targetBan) {
        targetBan = bannedUsers.find(ban => {
          const user = ban.user;
          return user.username.toLowerCase().includes(userInput) ||
                 user.tag.toLowerCase().includes(userInput) ||
                 user.displayName?.toLowerCase().includes(userInput);
        });
      }

      if (!targetBan) {
        return embeds.deny(message, `I couldn't find a banned user matching: **${args[0]}**`);
      }

      // Self-action check
      if (!checkSelfAction(message, targetBan.user, 'unban')) return;

      // Bot-action check
      if (!checkBotAction(message, targetBan.user)) return;

      // Get reason from arguments
      let reason = args.slice(1).join(" ");
      if (!reason) reason = 'reasons';

      // Perform the unban
      await message.guild.members.unban(targetBan.user.id, `${reason} | Unbanned by: ${message.author.tag}`);

      // Add to moderation history
      try {
        await moderationService.addModerationCase(
          message.guild.id,
          targetBan.user.id,
          message.author.id,
          'unban',
          reason
        );
      } catch (historyError) {
        // Don't fail the command if history logging fails
      }

      embeds.success(message, `**${targetBan.user.tag}** has been **unbanned** for ${reason}`);

      // Log the unban action
      await logModerationAction('unban', message.author, targetBan.user, reason, message.guild);

    } catch (error) {
      logger.webhook.error(error, 'Unban Command', {
        user: message.author,
        guild: message.guild,
        channel: message.channel,
        command: 'unban',
        args: `${targetBan?.user?.tag || args[0]} - ${reason}`
      });
      embeds.deny(message, 'An error occurred while trying to unban this user.');
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
