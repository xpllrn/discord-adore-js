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
  syntax: 'unban [user] (reason)',
  example: 'unban @vwsn appeal',
  permission: 'ban_members',
  run: async(client, message, args) => {
    const guildService = getService('guild');
    const antinukeService = getService('antinuke');

    // Permission checks first
    if (!await hasDiscordPermission(message, PermissionFlagsBits.BanMembers, 'Ban Members')) return;

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

      // Check if user is hardbanned
      const isHardbanned = await guildService.isHardbanned(message.guild.id, targetBan.user.id);

      if (isHardbanned) {
        // Check if user is antinuke admin or server owner
        const isOwner = message.author.id === message.guild.ownerId;
        const isAntiNukeAdmin = await antinukeService.isAdmin(message.guild.id, message.author.id);

        if (!isOwner && !isAntiNukeAdmin) {
          return embeds.deny(message, `**${targetBan.user.tag}** is **hardbanned**!\n\nOnly **antinuke admins** and the **server owner** can unban hardbanned users.`);
        }

        // Remove from hardban list
        await guildService.removeHardban(message.guild.id, targetBan.user.id);
      }

      // Get reason from arguments
      let reason = args.slice(1).join(" ");
      if (!reason) reason = 'reasons';

      // Perform the unban
      await message.guild.members.unban(targetBan.user.id, `${reason} | Unbanned by: ${message.author.tag}`);

      // Add to moderation history
      try {
        const action = isHardbanned ? 'unhardban' : 'unban';
        await guildService.addModerationCase(
          message.guild.id,
          targetBan.user.id,
          message.author.id,
          action,
          reason
        );
      } catch (historyError) {
        // Don't fail the command if history logging fails
      }

      if (isHardbanned) {
        embeds.success(message, `**${targetBan.user.tag}** has been **unhardbanned** for ${reason}`);
      } else {
        embeds.success(message, `**${targetBan.user.tag}** has been **unbanned** for ${reason}`);
      }

      // Log the unban action
      const action = isHardbanned ? 'unhardban' : 'unban';
      await logModerationAction(action, message.author, targetBan.user, reason, message.guild);

    } catch (error) {
      logger.webhook.error(error, 'Unban Command', {
        user: message.author,
        guild: message.guild,
        channel: message.channel,
        command: 'unban',
        args: `${targetBan?.user?.tag || args[0]} - ${reason}`
      });
      throw error;
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
