const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "banner",
  aliases: ['userbanner'],
  description: "show a user's global banner",
  syntax: 'banner (user)',
  example: 'banner @vwsn',
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

      // Fetch the full user object to get banner info
      const fullUser = await client.users.fetch(targetUser.id, { force: true });
      
      const bannerURL = fullUser.bannerURL({ 
        dynamic: true, 
        size: 4096 
      });

      if (!bannerURL) {
        return embeds.warn(message, `**${fullUser.username}** doesn't have a banner set`);
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${fullUser.username}'s Banner`)
        .setImage(bannerURL)
        .setFooter({ 
          text: `Requested by ${message.author.username}`, 
          iconURL: message.author.displayAvatarURL({ dynamic: true }) 
        });

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while fetching the banner');
    }
  },

  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription("Show a user's global banner")
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
        .setDescription('The user to get the banner of')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;

      const fullUser = await interaction.client.users.fetch(targetUser.id, { force: true });
      
      const bannerURL = fullUser.bannerURL({ 
        dynamic: true, 
        size: 4096 
      });

      if (!bannerURL) {
        return embeds.warn(interaction, `**${fullUser.username}** doesn't have a banner set`);
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${fullUser.username}'s Banner`)
        .setImage(bannerURL)
        .setFooter({ 
          text: `Requested by ${interaction.user.username}`, 
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
        });

      return interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, interaction);
      return embeds.deny(interaction, 'An error occurred while fetching the banner');
    }
  }
}
