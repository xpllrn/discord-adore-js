const { ContainerBuilder, MediaGalleryBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "avatar",
  aliases: ['av', 'pfp'],
  description: "show a user's global avatar",
  syntax: 'avatar (user)',
  example: 'avatar @vwsn',
  run: async(client, message, args) => {

    try {
      let targetUser = message.author;

      // If user provided an argument, find the user
      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);

        if (!userResult.found) {
          return embeds.warn(message, userResult.error);
        }

        // Get the User object (not GuildMember)
        targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
      }

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.embed.replace('#', ''), 16));

      // Title
      container.addTextDisplayComponents(
        (text) => text.setContent(`**${targetUser.username}'s Avatar**`)
      );

      // Image
      container.addMediaGalleryComponents((gallery) =>
        gallery.addItems(
          (item) => item
            .setURL(targetUser.displayAvatarURL({ size: 4096, extension: 'png' }))
            .setDescription(`${targetUser.username}'s avatar`)
        )
      );

      // Separator and buttons
      container.addSeparatorComponents((separator) => separator);
      container.addActionRowComponents((actionRow) =>
        actionRow.setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('WEBP')
            .setURL(targetUser.displayAvatarURL({ size: 4096, extension: 'webp' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('PNG')
            .setURL(targetUser.displayAvatarURL({ size: 4096, extension: 'png' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('JPG')
            .setURL(targetUser.displayAvatarURL({ size: 4096, extension: 'jpg' }))
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
    .setName('avatar')
    .setDescription("Show a user's global avatar")
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    ])
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to get the avatar of')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.embed.replace('#', ''), 16));

      // Title
      container.addTextDisplayComponents(
        (text) => text.setContent(`**${targetUser.username}'s Avatar**`)
      );

      // Image
      container.addMediaGalleryComponents((gallery) =>
        gallery.addItems(
          (item) => item
            .setURL(targetUser.displayAvatarURL({ size: 4096, extension: 'png' }))
            .setDescription(`${targetUser.username}'s avatar`)
        )
      );

      // Separator and buttons
      container.addSeparatorComponents((separator) => separator);
      container.addActionRowComponents((actionRow) =>
        actionRow.setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('WEBP')
            .setURL(targetUser.displayAvatarURL({ size: 4096, extension: 'webp' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('PNG')
            .setURL(targetUser.displayAvatarURL({ size: 4096, extension: 'png' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('JPG')
            .setURL(targetUser.displayAvatarURL({ size: 4096, extension: 'jpg' }))
        )
      );

      return interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

    } catch (error) {
      logger.webhook.error(error, interaction);
      return embeds.deny(interaction, 'An error occurred while fetching the avatar');
    }
  }
}
