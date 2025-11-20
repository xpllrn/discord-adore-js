const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findGuild } = require('../../../handlers/finder');

module.exports = {
  name: "guildbanner",
  aliases: ['serverbanner2', 'gbanner'],
  description: "show a server's banner",
  syntax: 'guildbanner <server>',
  example: 'guildbanner',
  run: async(client, message, args) => {

    try {
      let targetGuild = message.guild;

      // If server ID or name provided, use universal guild finder
      if (args[0]) {
        const guildResult = await findGuild(client, args[0]);

        if (!guildResult.found) {
          return embeds.warn(message, guildResult.error || 'Server not found');
        }

        targetGuild = guildResult.guild;
      }

      const bannerURL = targetGuild.bannerURL({
        dynamic: true,
        size: 4096
      });

      if (!bannerURL) {
        return embeds.warn(message, `**${targetGuild.name}** doesn't have a banner set`);
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${targetGuild.name}'s Banner`)
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
