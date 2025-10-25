const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { createPagination } = require('../../../core/buttons');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { colors } = require('../../../config/setup');
const { getService } = require('../../../database/services');
const { findUser } = require('../../../handlers/finder');

module.exports = {
  name: "history",
  description: `view and manage moderation history`,
  usage: '{guildprefix}history [user]\n{guildprefix}history [user] [action]\n{guildprefix}history view [caseid]\n{guildprefix}history remove [user] [caseid]\n{guildprefix}history removeall [user]',
  permission: 'Manage Messages',
  run: async(client, message, args) => {
    const moderationService = getService('moderation');

    if (!args[0]) {
      return runHelpCommand(message, 'history');
    }

    if (args[0] === 'view') {
      if (!args[1]) {
        return runHelpCommand(message, 'history');
      }

      const caseId = parseInt(args[1]);
      if (isNaN(caseId)) {
        return embeds.deny(message, 'Please provide a valid case ID number');
      }

      try {
        const moderationCase = await moderationService.getModerationCase(message.guild.id, caseId);

        if (!moderationCase) {
          return embeds.deny(message, `Case #${caseId} not found`);
        }

        const targetUser = await client.users.fetch(moderationCase.userId).catch(() => null);
        const moderator = await client.users.fetch(moderationCase.moderatorId).catch(() => null);

        const timestamp = Math.floor(moderationCase.timestamp.getTime() / 1000);

        const embed = new EmbedBuilder()
          .setColor(colors.embed)
          .setTitle(`Case #${moderationCase.caseId} | ${moderationCase.action}`)
          .addFields(
            { name: 'User', value: targetUser ? `${targetUser.username} (${targetUser.id})` : `Unknown User (${moderationCase.userId})`, inline: true },
            { name: 'Moderator', value: moderator ? `${moderator.username} (${moderator.id})` : `Unknown User (${moderationCase.moderatorId})`, inline: true },
            { name: 'Timestamp', value: `<t:${timestamp}:f>`, inline: true },
            { name: 'Reason', value: moderationCase.reason, inline: false }
          );

        if (moderationCase.duration) {
          embed.addFields({ name: 'Duration', value: moderationCase.duration, inline: true });
        }

        return message.channel.send({ embeds: [embed] });

      } catch (error) {
        return embeds.deny(message, 'An error occurred while retrieving the case');
      }
    }

    if (args[0] === 'remove') {
      if (!args[1] || !args[2]) {
        return runHelpCommand(message, 'history');
      }

      if (!hasDiscordPermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return;

      const userResult = await findUser(message.guild, args[1], client);
      if (!userResult.found) {
        return embeds.deny(message, userResult.error);
      }
      if (userResult.isGlobal) {
        return embeds.deny(message, 'User is not in this server');
      }

      const caseId = parseInt(args[2]);
      if (isNaN(caseId)) {
        return embeds.deny(message, 'Please provide a valid case ID number');
      }

      try {
        const moderationCase = await moderationService.getModerationCase(message.guild.id, caseId);

        if (!moderationCase) {
          return embeds.deny(message, `Case #${caseId} not found`);
        }

        if (moderationCase.userId !== userResult.user.user.id) {
          return embeds.deny(message, `Case #${caseId} does not belong to **${userResult.user.user.username}**`);
        }

        await moderationService.removeModerationCase(message.guild.id, caseId);
        return embeds.success(message, `Removed case #${caseId} for **${userResult.user.user.username}**`);

      } catch (error) {
        return embeds.deny(message, 'An error occurred while removing the case');
      }
    }

    if (args[0] === 'removeall') {
      if (!args[1]) {
        return runHelpCommand(message, 'history');
      }

      if (!hasDiscordPermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return;

      const userResult = await findUser(message.guild, args[1], client);
      if (!userResult.found) {
        return embeds.deny(message, userResult.error);
      }
      if (userResult.isGlobal) {
        return embeds.deny(message, 'User is not in this server');
      }

      try {
        const result = await moderationService.removeAllModerationCases(message.guild.id, userResult.user.user.id);

        if (result.deletedCount === 0) {
          return embeds.warn(message, `**${userResult.user.user.username}** has no moderation history to remove`);
        }

        return embeds.success(message, `Removed **${result.deletedCount}** case${result.deletedCount === 1 ? '' : 's'} for **${userResult.user.user.username}**`);

      } catch (error) {
        return embeds.deny(message, 'An error occurred while removing cases');
      }
    }

    const actionTypes = ['warn', 'mute', 'kick', 'ban', 'jail', 'unmute', 'unban', 'unjail', 'warns', 'kicks', 'bans', 'mutes', 'jails'];
    if (actionTypes.includes(args[0].toLowerCase())) {
      return runHelpCommand(message, 'history');
    }

    const userResult = await findUser(message.guild, args[0], client);
    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }
    if (userResult.isGlobal) {
      return embeds.deny(message, 'User is not in this server');
    }

    const user = userResult.user;
    const actionFilter = args[1] ? args[1].toLowerCase() : null;

    try {
      let moderationHistory;

      if (actionFilter && actionTypes.includes(actionFilter)) {
        moderationHistory = await moderationService.getModerationHistory(message.guild.id, user.user.id, actionFilter);
      } else {
        moderationHistory = await moderationService.getModerationHistory(message.guild.id, user.user.id);
      }

      if (moderationHistory.length === 0) {
        const filterText = actionFilter ? ` ${actionFilter}` : '';
        return embeds.warn(message, `**${user.user.username}** has no${filterText} moderation history`);
      }

      const formatPage = (pageItems, currentPage, totalPages) => {
        const historyList = pageItems.map((case_) => {
          const timestamp = Math.floor(case_.timestamp.getTime() / 1000);
          const moderator = message.guild.members.cache.get(case_.moderatorId);
          const moderatorName = moderator ? `${moderator.user.username}(${moderator.user.id})` : `Unknown User(${case_.moderatorId})`;

          return [
            `**case log #${case_.caseId} | ${case_.action}**`,
            `**Punished**: <t:${timestamp}:f>`,
            `**Moderator**: ${moderatorName}`,
            `**Reason**: ${case_.reason}`,
            ''
          ].join('\n');
        }).join('\n');

        const filterText = actionFilter ? ` ${actionFilter}` : '';
        return new EmbedBuilder()
          .setColor(colors.embed)
          .setTitle(`${filterText ? actionFilter.charAt(0).toUpperCase() + actionFilter.slice(1) : 'Moderation'} history for ${user.user.username}`)
          .setDescription(historyList)
          .setFooter({ text: `Page ${currentPage}/${totalPages} • ${moderationHistory.length} case${moderationHistory.length === 1 ? '' : 's'} total` });
      };

      await createPagination(message, moderationHistory, formatPage, 3, `History for ${user.user.username}`);

    } catch (error) {
      embeds.deny(message, 'An error occurred while retrieving moderation history.');
    }
  }
};
