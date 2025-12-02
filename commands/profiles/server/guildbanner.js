const { ContainerBuilder, MediaGalleryBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findGuild } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "guildbanner",
  aliases: ['serverbanner2', 'gbanner'],
  description: "show a server's banner",
  syntax: 'guildbanner (server)',
  example: 'guildbanner',
  run: async(client, message, args) => {

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

      const bannerURL = targetGuild.bannerURL({ size: 4096, extension: 'png' });

      if (!bannerURL) {
        return embeds.warn(message, `**${targetGuild.name}** doesn't have a banner set`);
      }

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.embed.replace('#', ''), 16));

      // Title
      container.addTextDisplayComponents(
        (text) => text.setContent(`**${targetGuild.name}'s Banner**`)
      );

      // Image
      container.addMediaGalleryComponents((gallery) =>
        gallery.addItems(
          (item) => item
            .setURL(bannerURL)
            .setDescription(`${targetGuild.name}'s banner`)
        )
      );

      // Separator and buttons
      container.addSeparatorComponents((separator) => separator);
      container.addActionRowComponents((actionRow) =>
        actionRow.setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('WEBP')
            .setURL(targetGuild.bannerURL({ size: 4096, extension: 'webp' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('PNG')
            .setURL(targetGuild.bannerURL({ size: 4096, extension: 'png' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('JPG')
            .setURL(targetGuild.bannerURL({ size: 4096, extension: 'jpg' }))
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
    .setName('guildbanner')
    .setDescription("Show a server's banner")
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

      const bannerURL = targetGuild.bannerURL({ size: 4096, extension: 'png' });

      if (!bannerURL) {
        return embeds.warn(interaction, `**${targetGuild.name}** doesn't have a banner set`);
      }

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.embed.replace('#', ''), 16));

      // Title
      container.addTextDisplayComponents(
        (text) => text.setContent(`**${targetGuild.name}'s Banner**`)
      );

      // Image
      container.addMediaGalleryComponents((gallery) =>
        gallery.addItems(
          (item) => item
            .setURL(bannerURL)
            .setDescription(`${targetGuild.name}'s banner`)
        )
      );

      // Separator and buttons
      container.addSeparatorComponents((separator) => separator);
      container.addActionRowComponents((actionRow) =>
        actionRow.setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('WEBP')
            .setURL(targetGuild.bannerURL({ size: 4096, extension: 'webp' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('PNG')
            .setURL(targetGuild.bannerURL({ size: 4096, extension: 'png' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('JPG')
            .setURL(targetGuild.bannerURL({ size: 4096, extension: 'jpg' }))
        )
      );

      return interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

    } catch (error) {
      logger.webhook.error(error, interaction);
      return embeds.deny(interaction, 'An error occurred while fetching the server banner');
    }
  }
}
