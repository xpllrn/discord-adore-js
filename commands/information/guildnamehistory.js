const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasPermissionLevel } = require('../../utils/permissions');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { ensureGuildData } = require('../../database');
const { createPagination, createConfirmation } = require('../../core/buttons');
const { getService } = require('@services');
const config = require('../../config/setup');
const logger = require('../../utils/logger');

module.exports = {
  name: "guildhistory",
  aliases: ['gnames'],
  description: `view the server's name change history`,
  syntax: 'guildhistory',
  example: 'guildhistory',
  run: async (client, message, args) => {
    const guildService = getService('guild');

    // Ensure guild data exists in the database
    await ensureGuildData(message.guild.id);

    try {
      const nameHistory = await guildService.getGuildNameHistory(message.guild.id);

      if (nameHistory.length === 0) {
        return embeds.info(message, 'No guild name changes recorded for this server');
      }

      // Sort by most recent first
      const sortedHistory = nameHistory.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));

      // Format page function for pagination
      const formatPage = (pageHistory, currentPage, totalPages) => {
        const historyList = pageHistory.map((change, index) => {
          const number = ((currentPage - 1) * 10 + index + 1).toString().padStart(2, '0');
          const timestamp = `<t:${Math.floor(new Date(change.changedAt).getTime() / 1000)}:R>`;

          return `\`${number}\` **${change.newName}** (${timestamp})`;
        }).join('\n');

        return new EmbedBuilder()
          .setColor(config.colors.embed)
          .setAuthor({
            name: `Name History for ${message.guild.name}`,
            iconURL: message.guild.iconURL({ dynamic: true }) || message.author.displayAvatarURL({ dynamic: true })
          })
          .setDescription(historyList)
          .setFooter({ text: `${sortedHistory.length} name changes • Page ${currentPage}/${totalPages}` });
      };

      // Use pagination system with 10 items per page
      await createPagination(message, sortedHistory, formatPage, 5, 'Guild Name History');
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'Failed to retrieve guild name history');
    }
  }
}
