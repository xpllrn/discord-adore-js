const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "savatar",
  aliases: ['serveravatar', 'sav'],
  description: "show a user's server-specific avatar",
  syntax: 'savatar (user)',
  example: 'savatar @vwsn',
  run: async (client, message, args) => {

    try {
      let targetMember = message.member;

      // If user provided an argument, find the member
      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);

        if (!userResult.found) {
          return embeds.warn(message, userResult.error);
        }

        // For server avatar, we need a guild member, not a global user
        if (userResult.isGlobal) {
          return embeds.warn(message, 'User is not in this server');
        }

        targetMember = userResult.user;
      }

      // Get the member's server avatar (falls back to global avatar if no server avatar)
      const avatarURL = targetMember.displayAvatarURL({
        dynamic: true,
        size: 4096
      });

      // Check if they have a server-specific avatar
      const hasServerAvatar = targetMember.avatar !== null;
      const avatarType = hasServerAvatar ? 'Server Avatar' : 'Server Avatar';

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${targetMember.user.username}'s ${avatarType}`)
        .setImage(avatarURL)
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        });

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while fetching the server avatar');
    }
  }
}
