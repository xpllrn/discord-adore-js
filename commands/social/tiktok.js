const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { fetch } = require('undici');
const logger = require('../../utils/logger');

async function fetchTikTokProfile(username, requester) {
  const results = await fetch(`https://www.tikwm.com/api/user/info?unique_id=${username}`, {
    method: 'POST'
  }).then((response) => response.json());

  if (!results.data) {
    throw new Error('Profile not found');
  }

  const { user, stats } = results.data;

  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setAuthor({
      name: requester.displayName || requester.username,
      iconURL: requester.displayAvatarURL({ dynamic: true })
    })
    .setTitle(`${user.uniqueId !== user.nickname ? `${user.nickname} (@${user.uniqueId})` : `${user.uniqueId}`} ${user.privateAccount ? '🔒' : user.verified ? '☑️' : ''}`)
    .setURL(`https://www.tiktok.com/@${user.uniqueId}`)
    .setDescription(user.signature || 'No bio available')
    .addFields([
      {
        name: 'Videos',
        value: stats.videoCount.toLocaleString(),
        inline: true
      },
      {
        name: 'Followers',
        value: stats.followerCount.toLocaleString(),
        inline: true
      },
      {
        name: 'Following',
        value: stats.followingCount.toLocaleString(),
        inline: true
      },
      {
        name: 'Likes',
        value: stats.heartCount.toLocaleString(),
        inline: true
      }
    ])
    .setThumbnail(user.avatarLarger);

  return embed;
}

module.exports = {
  name: "tiktok",
  aliases: ['tt'],
  description: 'Get information about a TikTok profile',
  syntax: 'tiktok (username)',
  example: 'tiktok @vwsn',
  run: async(client, message, args) => {
    try {
      if (!args[0]) {
        return runHelpCommand(message, 'tiktok');
      }

      const username = String(args[0]).toLowerCase().replace('@', '');

      message.channel.sendTyping();

      const embed = await fetchTikTokProfile(username, message.member);
      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      throw error;
    }
  },

  data: new SlashCommandBuilder()
    .setName('tiktok')
    .setDescription('Get information about a TikTok profile')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    ])
    .addStringOption(option =>
      option.setName('username')
        .setDescription('TikTok username (without @)')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const username = interaction.options.getString('username').toLowerCase().replace('@', '');

      await interaction.deferReply();

      const embed = await fetchTikTokProfile(username, interaction.user);
      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, interaction);
      return embeds.deny(interaction, 'An error occurred while fetching the TikTok profile');
    }
  }
}
