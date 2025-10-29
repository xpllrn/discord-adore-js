const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { findUser } = require('../../handlers/finder');
const { ensureUserData } = require('../../database');
const { createPagination } = require('../../core/buttons');
const { getService } = require('@services');
const config = require('../../config/setup');

module.exports = {
  name: "names",
  aliases: ['nh', 'namehistory'],
  description: `view a user's name change history`,
  syntax: 'names (user)',
  example: 'names @vwsn',
  run: async(client, message, args) => {
    const userService = getService('user');

    let targetUser = message.author;
    let targetMember = message.member;

    // If user specified, find them
    if (args[0]) {
      const userResult = await findUser(message.guild, args[0], client);
      
      if (!userResult.found) {
        return embeds.warn(message, userResult.error || 'User not found');
      }

      if (userResult.isGlobal) {
        targetUser = userResult.user;
        targetMember = null;
      } else {
        targetUser = userResult.user.user || userResult.user;
        targetMember = userResult.user;
      }
    }

    // Ensure user data exists in the database
    await ensureUserData(targetUser.id);

    try {
      const nameHistory = await userService.getNameHistory(targetUser.id);
      
      if (nameHistory.length === 0) {
        const username = targetMember ? targetMember.displayName : targetUser.username;
        return embeds.info(message, `**${username}** has no recorded name changes`);
      }

      // Sort by most recent first
      const sortedHistory = nameHistory.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));

      const username = targetMember ? targetMember.displayName : targetUser.username;

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
            name: `Name History for ${username}`,
            iconURL: targetUser.displayAvatarURL({ dynamic: true })
          })
          .setDescription(historyList)
          .setFooter({ text: `${sortedHistory.length} name changes • Page ${currentPage}/${totalPages}` });
      };

      // Use pagination system with 5 items per page
      await createPagination(message, sortedHistory, formatPage, 5, 'Name History');
    } catch (error) {
      console.error('Error getting name history:', error);
      return embeds.deny(message, 'Failed to retrieve name history');
    }
  }
}
