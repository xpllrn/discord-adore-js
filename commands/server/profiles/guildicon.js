const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findGuild } = require('../../../handlers/finder');

module.exports = {
  name: "guildicon",
  aliases: ['servericon', 'icon'],
  description: "show a server's icon",
  usage: '{guildprefix}guildicon [server id or name]',
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

      const iconURL = targetGuild.iconURL({
        dynamic: true,
        size: 4096
      });

      if (!iconURL) {
        return embeds.warn(message, `**${targetGuild.name}** doesn't have an icon set`);
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${targetGuild.name}'s Icon`)
        .setImage(iconURL)
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        });

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      return embeds.warn(message, 'An error occurred while fetching the server icon.');
    }
  }
}
