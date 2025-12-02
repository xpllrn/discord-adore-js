const { ContainerBuilder, MediaGalleryBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "sbanner",
  aliases: ['serverbanner'],
  description: "show a user's server-specific banner",
  syntax: 'sbanner (user)',
  example: 'sbanner @vwsn',
  run: async(client, message, args) => {

    try {
      let targetMember = message.member;

      // If user provided an argument, find the member
      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);

        if (!userResult.found) {
          return embeds.warn(message, userResult.error);
        }

        // For server banner, we need a guild member, not a global user
        if (userResult.isGlobal) {
          return embeds.warn(message, 'User is not in this server');
        }

        targetMember = userResult.user;
      }

      // Get the member's server banner
      let bannerURL = targetMember.bannerURL({ size: 4096, extension: 'png' });
      let bannerType = 'Server Banner';

      if (!bannerURL) {
        // If no server banner, try to get global banner
        const fullUser = await client.users.fetch(targetMember.user.id, { force: true });
        bannerURL = fullUser.bannerURL({ size: 4096, extension: 'png' });

        if (!bannerURL) {
          return embeds.warn(message, `**${targetMember.user.username}** doesn't have a banner set`);
        }

        bannerType = 'Global Banner (No Server Banner Set)';
      }

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.embed.replace('#', ''), 16));

      // Title
      container.addTextDisplayComponents(
        (text) => text.setContent(`**${targetMember.user.username}'s ${bannerType}**`)
      );

      // Image
      container.addMediaGalleryComponents((gallery) =>
        gallery.addItems(
          (item) => item
            .setURL(bannerURL)
            .setDescription(`${targetMember.user.username}'s banner`)
        )
      );

      // Separator and buttons
      container.addSeparatorComponents((separator) => separator);
      container.addActionRowComponents((actionRow) =>
        actionRow.setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('WEBP')
            .setURL(bannerURL.replace('.png', '.webp')),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('PNG')
            .setURL(bannerURL),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('JPG')
            .setURL(bannerURL.replace('.png', '.jpg'))
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
    .setName('sbanner')
    .setDescription("Show a user's server-specific banner")
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
    .setContexts([InteractionContextType.Guild])
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to get the server banner of')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return embeds.warn(interaction, 'This command can only be used in a server');
      }

      const targetUser = interaction.options.getUser('user') || interaction.user;
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return embeds.warn(interaction, 'User is not in this server');
      }

      let bannerURL = targetMember.bannerURL({ size: 4096, extension: 'png' });
      let bannerType = 'Server Banner';

      if (!bannerURL) {
        const fullUser = await interaction.client.users.fetch(targetMember.user.id, { force: true });
        bannerURL = fullUser.bannerURL({ size: 4096, extension: 'png' });

        if (!bannerURL) {
          return embeds.warn(interaction, `**${targetMember.user.username}** doesn't have a banner set`);
        }

        bannerType = 'Global Banner (No Server Banner Set)';
      }

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.embed.replace('#', ''), 16));

      // Title
      container.addTextDisplayComponents(
        (text) => text.setContent(`**${targetMember.user.username}'s ${bannerType}**`)
      );

      // Image
      container.addMediaGalleryComponents((gallery) =>
        gallery.addItems(
          (item) => item
            .setURL(bannerURL)
            .setDescription(`${targetMember.user.username}'s banner`)
        )
      );

      // Separator and buttons
      container.addSeparatorComponents((separator) => separator);
      container.addActionRowComponents((actionRow) =>
        actionRow.setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('WEBP')
            .setURL(bannerURL.replace('.png', '.webp')),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('PNG')
            .setURL(bannerURL),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('JPG')
            .setURL(bannerURL.replace('.png', '.jpg'))
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
