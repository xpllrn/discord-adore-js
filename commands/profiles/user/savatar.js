const { ContainerBuilder, MediaGalleryBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "savatar",
  aliases: ['serveravatar', 'sav'],
  description: "show a user's server-specific avatar",
  syntax: 'savatar (user)',
  example: 'savatar @vwsn',
  run: async (client, message, args) => {

    try {
      // Collect all target members
      const targetMembers = [];

      if (args.length === 0) {
        // No args, use message author
        targetMembers.push(message.member);
      } else {
        // Find all mentioned members
        for (const arg of args) {
          const userResult = await findUser(message.guild, arg, client);
          if (userResult.found && !userResult.isGlobal) {
            const member = userResult.user;
            // Avoid duplicates
            if (!targetMembers.some(m => m.id === member.id)) {
              targetMembers.push(member);
            }
          }
        }

        // If no valid members found, show error
        if (targetMembers.length === 0) {
          return embeds.warn(message, 'No valid server members found');
        }
      }

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.embed.replace('#', ''), 16));

      // Single member - original behavior with download buttons
      if (targetMembers.length === 1) {
        const targetMember = targetMembers[0];

        container.addTextDisplayComponents(
          (text) => text.setContent(`**${targetMember.user.username}'s Server Avatar**`)
        );

        container.addMediaGalleryComponents((gallery) =>
          gallery.addItems(
            (item) => item
              .setURL(targetMember.displayAvatarURL({ size: 4096, extension: 'png' }))
              .setDescription(`${targetMember.user.username}'s server avatar`)
          )
        );

        container.addSeparatorComponents((separator) => separator);
        container.addActionRowComponents((actionRow) =>
          actionRow.setComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setLabel('WEBP')
              .setURL(targetMember.displayAvatarURL({ size: 4096, extension: 'webp' })),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setLabel('PNG')
              .setURL(targetMember.displayAvatarURL({ size: 4096, extension: 'png' })),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setLabel('JPG')
              .setURL(targetMember.displayAvatarURL({ size: 4096, extension: 'jpg' }))
          )
        );
      } else {
        // Multiple members - gallery view
        container.addTextDisplayComponents(
          (text) => text.setContent(`**Server Avatars (${targetMembers.length} users)**`)
        );

        container.addMediaGalleryComponents((gallery) => {
          for (const member of targetMembers) {
            gallery.addItems(
              (item) => item
                .setURL(member.displayAvatarURL({ size: 4096, extension: 'png' }))
                .setDescription(`${member.user.username}'s server avatar`)
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
    .setName('savatar')
    .setDescription("Show a user's server-specific avatar")
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
    .setContexts([InteractionContextType.Guild])
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to get the server avatar of')
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

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.embed.replace('#', ''), 16));

      // Title
      container.addTextDisplayComponents(
        (text) => text.setContent(`**${targetMember.user.username}'s Server Avatar**`)
      );

      // Image
      container.addMediaGalleryComponents((gallery) =>
        gallery.addItems(
          (item) => item
            .setURL(targetMember.displayAvatarURL({ size: 4096, extension: 'png' }))
            .setDescription(`${targetMember.user.username}'s server avatar`)
        )
      );

      // Separator and buttons
      container.addSeparatorComponents((separator) => separator);
      container.addActionRowComponents((actionRow) =>
        actionRow.setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('WEBP')
            .setURL(targetMember.displayAvatarURL({ size: 4096, extension: 'webp' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('PNG')
            .setURL(targetMember.displayAvatarURL({ size: 4096, extension: 'png' })),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('JPG')
            .setURL(targetMember.displayAvatarURL({ size: 4096, extension: 'jpg' }))
        )
      );

      return interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

    } catch (error) {
      logger.webhook.error(error, interaction);
      return embeds.deny(interaction, 'An error occurred while fetching the server avatar');
    }
  }
}
