const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
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
      let targetMember = message.member;

      // If user provided an argument, find the member
      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);

        if (!userResult.found) {
          return embeds.warn(message, userResult.error);
        }

        // For server avatar, we need a guild member, not a global user
        if (userResult.isGlobal) {
          return embeds.warn(message, 'User is not in this server');
        }

        targetMember = userResult.user;
      }

      // Get the member's server avatar (falls back to global avatar if no server avatar)
      const avatarURL = targetMember.displayAvatarURL({
        dynamic: true,
        size: 4096
      });

      // Check if they have a server-specific avatar
      const hasServerAvatar = targetMember.avatar !== null;
      const avatarType = hasServerAvatar ? 'Server Avatar' : 'Server Avatar';

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${targetMember.user.username}'s ${avatarType}`)
        .setImage(avatarURL)
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        });

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while fetching the server avatar');
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

      const avatarURL = targetMember.displayAvatarURL({
        dynamic: true,
        size: 4096
      });

      const hasServerAvatar = targetMember.avatar !== null;
      const avatarType = hasServerAvatar ? 'Server Avatar' : 'Server Avatar';

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${targetMember.user.username}'s ${avatarType}`)
        .setImage(avatarURL)
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        });

      return interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, interaction);
      return embeds.deny(interaction, 'An error occurred while fetching the server avatar');
    }
  }
}
