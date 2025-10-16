const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findGuild } = require('../../../handlers/finder');

module.exports = {
  name: "guildsplash",
  aliases: ['serversplash', 'splash'],
  description: "show a server's invite splash screen",
  usage: '{guildprefix}guildsplash [server id or name]',
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

      const splashURL = targetGuild.splashURL({
        dynamic: true,
        size: 4096
      });

      if (!splashURL) {
        return embeds.warn(message, `**${targetGuild.name}** doesn't have a splash screen set`);
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${targetGuild.name}'s Splash Screen`)
        .setImage(splashURL)
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        });

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      return embeds.warn(message, 'An error occurred while fetching the server splash screen.');
    }
  }
}
