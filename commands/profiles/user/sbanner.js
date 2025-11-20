const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findUser } = require('../../../handlers/finder');

module.exports = {
  name: "sbanner",
  aliases: ['serverbanner'],
  description: "show a user's server-specific banner",
  syntax: 'sbanner <user>',
  example: 'sbanner @vwsn',
  run: async(client, message, args) => {

    try {
      let targetMember = message.member;

      // If user provided an argument, find the member
      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);

        if (!userResult.found) {
          return embeds.warn(message, userResult.error || 'User not found');
        }

        // For server banner, we need a guild member, not a global user
        if (userResult.isGlobal) {
          return embeds.warn(message, 'User is not in this server');
        }

        targetMember = userResult.user;
      }

      // Get the member's server banner
      const bannerURL = targetMember.bannerURL({ 
        dynamic: true, 
        size: 4096 
      });

      if (!bannerURL) {
        // If no server banner, try to get global banner
        const fullUser = await client.users.fetch(targetMember.user.id, { force: true });
        const globalBannerURL = fullUser.bannerURL({ 
          dynamic: true, 
          size: 4096 
        });

        if (!globalBannerURL) {
          return embeds.warn(message, `**${targetMember.user.username}** doesn't have a banner set`);
        }

        const embed = new EmbedBuilder()
          .setColor(colors.embed)
          .setTitle(`${targetMember.user.username}'s Global Banner (No Server Banner Set)`)
          .setImage(globalBannerURL)
          .setFooter({ 
            text: `Requested by ${message.author.username}`, 
            iconURL: message.author.displayAvatarURL({ dynamic: true }) 
          });

        return message.channel.send({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${targetMember.user.username}'s Server Banner`)
        .setImage(bannerURL)
        .setFooter({ 
          text: `Requested by ${message.author.username}`, 
          iconURL: message.author.displayAvatarURL({ dynamic: true }) 
        });

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      return embeds.warn(message, 'An error occurred while fetching the server banner.');
    }
  }
}
