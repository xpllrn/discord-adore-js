const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { createPagination } = require('../../../core/buttons');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { colors } = require('../../../config/setup');
const { getService } = require('../../../database/services');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "modhistory",
  aliases: ['mhistory', 'mh'],
  description: `view moderation actions performed by moderators`,
  syntax: 'modhistory [moderator] (action)',
  example: 'modhistory @vwsn warn',
  permission: 'manage_messages',
  run: async(client, message, args) => {
    const guildService = getService('guild');

    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return;

    if (!args[0]) {
      return runHelpCommand(message, 'modhistory');
    }

    const userResult = await findUser(message.guild, args[0], client);
    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }
    if (userResult.isGlobal) {
      return embeds.deny(message, 'User is not in this server');
    }

    const moderator = userResult.user;
    const actionFilter = args[1] ? args[1].toLowerCase() : null;

    try {
      let moderationHistory;
      const actionTypes = ['warn', 'mute', 'kick', 'ban', 'jail', 'unmute', 'unban', 'unjail'];

      if (actionFilter && actionTypes.includes(actionFilter)) {
        moderationHistory = await guildService.getModerationHistoryByModerator(message.guild.id, moderator.user.id, actionFilter);
      } else {
        moderationHistory = await guildService.getModerationHistoryByModerator(message.guild.id, moderator.user.id);
      }

      if (moderationHistory.length === 0) {
        const filterText = actionFilter ? ` ${actionFilter}` : '';
        return embeds.warn(message, `**${moderator.user.username}** has no${filterText} moderation actions recorded`);
      }

      const formatPage = (pageItems, currentPage, totalPages) => {
        const historyList = pageItems.map((case_) => {
          const timestamp = Math.floor(case_.timestamp.getTime() / 1000);
          const targetUser = message.guild.members.cache.get(case_.userId);
          const targetName = targetUser ? `${targetUser.user.username}(${targetUser.user.id})` : `Unknown User(${case_.userId})`;

          return [
            `**Case #${case_.caseId} | ${case_.action}**`,
            `**Target**: ${targetName}`,
            `**Date**: <t:${timestamp}:F> (<t:${timestamp}:R>)`,
            `**Reason**: ${case_.reason}`,
            ''
          ].join('\n');
        }).join('\n');

        const filterText = actionFilter ? ` ${actionFilter}` : '';
        return new EmbedBuilder()
          .setColor(colors.embed)
          .setTitle(`${filterText ? actionFilter.charAt(0).toUpperCase() + actionFilter.slice(1) : 'Moderation'} actions by ${moderator.user.username}`)
          .setDescription(historyList)
          .setThumbnail(moderator.user.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: `Page ${currentPage}/${totalPages} • ${moderationHistory.length} action${moderationHistory.length === 1 ? '' : 's'} total` });
      };

      await createPagination(message, moderationHistory, formatPage, 3, `Mod actions by ${moderator.user.username}`);

    } catch (error) {
      throw error;
    }
  }
};
