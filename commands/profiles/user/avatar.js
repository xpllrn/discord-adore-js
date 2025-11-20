const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findUser } = require('../../../handlers/finder');

module.exports = {
  name: "avatar",
  aliases: ['av', 'pfp'],
  description: "show a user's global avatar",
  syntax: 'avatar <user>',
  example: 'avatar @vwsn',
  run: async(client, message, args) => {

    try {
      let targetUser = message.author;

      // If user provided an argument, find the user
      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);

        if (!userResult.found) {
          return embeds.warn(message, userResult.error || 'User not found');
        }

        // Get the User object (not GuildMember)
        targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
      }

      // Get the user's global avatar
      const avatarURL = targetUser.displayAvatarURL({ 
        dynamic: true, 
        size: 4096 
      });

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${targetUser.displayName || targetUser.username || 'User'}'s Avatar`)
        .setImage(avatarURL)
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        });

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      return embeds.warn(message, 'An error occurred while fetching the avatar.');
    }
  }
}
