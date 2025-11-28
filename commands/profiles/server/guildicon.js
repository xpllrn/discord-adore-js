const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findGuild } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "guildicon",
  aliases: ['servericon', 'icon', 'serverpfp'],
  description: "show a server's icon",
  syntax: 'guildicon (server)',
  example: 'guildicon',
  run: async (client, message, args) => {

    try {
      let targetGuild = message.guild;

      // If server ID or name provided, use universal guild finder
      if (args[0]) {
        const guildResult = await findGuild(client, args[0]);

        if (!guildResult.found) {
          return embeds.warn(message, guildResult.error);
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
      throw error;
    }
  },

  data: new SlashCommandBuilder()
    .setName('guildicon')
    .setDescription("Show a server's icon")
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return embeds.warn(interaction, 'This command can only be used in a server');
      }

      const targetGuild = interaction.guild;

      const iconURL = targetGuild.iconURL({
        dynamic: true,
        size: 4096
      });

      if (!iconURL) {
        return embeds.warn(interaction, `**${targetGuild.name}** doesn't have an icon set`);
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${targetGuild.name}'s Icon`)
        .setImage(iconURL)
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        });

      return interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, interaction);
      return embeds.deny(interaction, 'An error occurred while fetching the server icon');
    }
  }
}
