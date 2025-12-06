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
      // Collect all target users
      const targetUsers = [];

      if (args.length === 0) {
        // No args, use message author
        targetUsers.push(message.author);
      } else {
        // Find all mentioned users
        for (const arg of args) {
          const userResult = await findUser(message.guild, arg, client);
          if (userResult.found) {
            const user = userResult.isGlobal ? userResult.user : userResult.user.user;
            // Avoid duplicates
            if (!targetUsers.some(u => u.id === user.id)) {
              targetUsers.push(user);
            }
          }
        }

        // If no valid users found, show error
        if (targetUsers.length === 0) {
          return embeds.warn(message, 'No valid users found');
        }
      }

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.embed.replace('#', ''), 16));

      // Single user - original behavior with download buttons
      if (targetUsers.length === 1) {
        const targetUser = targetUsers[0];

        container.addTextDisplayComponents(
          (text) => text.setContent(`**${targetUser.username}'s Avatar**`)
        );

        container.addMediaGalleryComponents((gallery) =>
          gallery.addItems(
            (item) => item
              .setURL(targetUser.displayAvatarURL({ size: 4096, extension: 'png' }))
              .setDescription(`${targetUser.username}'s avatar`)
          )
        );

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
      } else {
        // Multiple users - gallery view
        container.addTextDisplayComponents(
          (text) => text.setContent(`**Avatars (${targetUsers.length} users)**`)
        );

        container.addMediaGalleryComponents((gallery) => {
          for (const user of targetUsers) {
            gallery.addItems(
              (item) => item
                .setURL(user.displayAvatarURL({ size: 4096, extension: 'png' }))
                .setDescription(`${user.username}'s avatar`)
            );
          }
          return gallery;
        });
      }

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
