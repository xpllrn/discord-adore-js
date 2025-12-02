const { ContainerBuilder, MediaGalleryBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
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

      const iconURL = targetGuild.iconURL({ size: 4096, extension: 'png' });

      if (!iconURL) {
        return embeds.warn(message, `**${targetGuild.name}** doesn't have an icon set`);
      }

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.embed.replace('#', ''), 16));

      // Title
      container.addTextDisplayComponents(
        (text) => text.setContent(`**${targetGuild.name}'s Icon**`)
      );

      // Image
      container.addMediaGalleryComponents((gallery) =>
        gallery.addItems(
          (item) => item
            .setURL(iconURL)
            .setDescription(`${targetGuild.name}'s icon`)
        )
      );

      // Separator and buttons
      container.addSeparatorComponents((separator) => separator);
      container.addActionRowComponents((actionRow) =>
        actionRow.setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('WEBP')
            .setURL(targetGuild.iconURL({ size: 4096, extension: 'webp' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('PNG')
            .setURL(targetGuild.iconURL({ size: 4096, extension: 'png' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('JPG')
            .setURL(targetGuild.iconURL({ size: 4096, extension: 'jpg' }))
        )
      );

      return message.channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

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

      const iconURL = targetGuild.iconURL({ size: 4096, extension: 'png' });

      if (!iconURL) {
        return embeds.warn(interaction, `**${targetGuild.name}** doesn't have an icon set`);
      }

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.embed.replace('#', ''), 16));

      // Title
      container.addTextDisplayComponents(
        (text) => text.setContent(`**${targetGuild.name}'s Icon**`)
      );

      // Image
      container.addMediaGalleryComponents((gallery) =>
        gallery.addItems(
          (item) => item
            .setURL(iconURL)
            .setDescription(`${targetGuild.name}'s icon`)
        )
      );

      // Separator and buttons
      container.addSeparatorComponents((separator) => separator);
      container.addActionRowComponents((actionRow) =>
        actionRow.setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('WEBP')
            .setURL(targetGuild.iconURL({ size: 4096, extension: 'webp' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('PNG')
            .setURL(targetGuild.iconURL({ size: 4096, extension: 'png' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('JPG')
            .setURL(targetGuild.iconURL({ size: 4096, extension: 'jpg' }))
        )
      );

      return interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

    } catch (error) {
      logger.webhook.error(error, interaction);
      return embeds.deny(interaction, 'An error occurred while fetching the server icon');
    }
  }
}
