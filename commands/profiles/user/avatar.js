const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
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

      // Get the user's global avatar
      const avatarURL = targetUser.displayAvatarURL({ 
        dynamic: true, 
        size: 4096 
      });

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${targetUser.displayName || targetUser.username || 'User'}'s Avatar`)
        .setImage(avatarURL)
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        });

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while fetching the avatar');
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

      const avatarURL = targetUser.displayAvatarURL({ 
        dynamic: true, 
        size: 4096 
      });

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${targetUser.displayName || targetUser.username || 'User'}'s Avatar`)
        .setImage(avatarURL)
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        });

      return interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, interaction);
      return embeds.deny(interaction, 'An error occurred while fetching the avatar');
    }
  }
}
