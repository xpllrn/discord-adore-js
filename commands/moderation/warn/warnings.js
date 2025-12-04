const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { createPagination } = require('../../../core/buttons');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { colors } = require('../../../config/setup');
const { getService } = require('../../../database/services');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "warnings",
  aliases: ['warns'],
  description: `view warnings for a user`,
  syntax: 'warnings [user]',
  example: 'warnings @vwsn',
  permission: 'manage_messages',
  run: async(client, message, args) => {
    const guildService = getService('guild');

    if (!args[0]) {
      return runHelpCommand(message, 'warnings');
    }

    const userResult = await findUser(message.guild, args[0], client);
    
    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }

    if (userResult.isGlobal) {
      return embeds.deny(message, `I was unable to find a **user** in this server with the name: **${args[0]}**`);
    }

    const user = userResult.user;

    try {
      const moderationHistory = await guildService.getModerationHistory(message.guild.id, user.user.id, 'warn');

      if (moderationHistory.length === 0) {
        return embeds.warn(message, `**${user.user.username}** has no warnings`);
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

        return new EmbedBuilder()
          .setColor(colors.embed)
          .setTitle(`Warn history for ${user.user.username}`)
          .setDescription(historyList)
          .setFooter({ text: `Page ${currentPage}/${totalPages} • ${moderationHistory.length} case${moderationHistory.length === 1 ? '' : 's'} total` });
      };

      await createPagination(message, moderationHistory, formatPage, 3, `Warnings for ${user.user.username}`);

    } catch (error) {
      throw error;
    }
  }
};
