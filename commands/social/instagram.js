const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { fetch } = require('undici');
const logger = require('../../utils/logger');

async function fetchInstagramProfile(username, requester) {
  let results;
  
  try {
    const response = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-IG-App-ID': '936619743392459',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.instagram.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Instagram profile "@${username}" not found`);
      } else if (response.status === 429) {
        throw new Error('Instagram rate limit reached. Please try again later');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('Instagram API access denied. The service may be temporarily unavailable');
      }
      throw new Error(`Failed to fetch profile (Status: ${response.status})`);
    }

    results = await response.json();

    if (!results.data || !results.data.user) {
      throw new Error(`Profile data unavailable for "@${username}"`);
    }
  } catch (error) {
    // Re-throw with more context if it's a network error
    if (error.message.includes('fetch failed')) {
      throw new Error('Unable to connect to Instagram. Please check your internet connection');
    }
    throw error;
  }

  const user = results.data.user;

  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setAuthor({
      name: requester.displayName || requester.username,
      iconURL: requester.displayAvatarURL({ dynamic: true })
    })
    .setTitle(`${user.full_name ? `${user.full_name} (@${user.username})` : `${user.username}`} ${user.is_private ? '🔒' : user.is_verified ? '☑️' : ''}`)
    .setURL(`https://www.instagram.com/${user.username}`)
    .setDescription(user.biography || 'No bio available')
    .addFields([
      {
        name: 'Posts',
        value: user.edge_owner_to_timeline_media.count.toLocaleString(),
        inline: true
      },
      {
        name: 'Followers',
        value: user.edge_followed_by.count.toLocaleString(),
        inline: true
      },
      {
        name: 'Following',
        value: user.edge_follow.count.toLocaleString(),
        inline: true
      }
    ])
    .setThumbnail(user.profile_pic_url_hd || user.profile_pic_url);

  if (user.external_url) {
    embed.addFields([
      {
        name: 'Website',
        value: user.external_url,
        inline: false
      }
    ]);
  }

  return embed;
}

module.exports = {
  name: "instagram",
  aliases: ['ig', 'insta'],
  description: 'Get information about an Instagram profile',
  syntax: 'instagram (username)',
  example: 'instagram @cristiano',
  run: async(client, message, args) => {
    try {
      if (!args[0]) {
        return runHelpCommand(message, 'instagram');
      }

      const username = String(args[0]).toLowerCase().replace('@', '');

      message.channel.sendTyping();

      const embed = await fetchInstagramProfile(username, message.member);
      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, message);
      const errorMessage = error.message || 'An error occurred while fetching the Instagram profile';
      return embeds.deny(message, errorMessage);
    }
  },

  data: new SlashCommandBuilder()
    .setName('instagram')
    .setDescription('Get information about an Instagram profile')
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
        .setDescription('Instagram username (without @)')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const username = interaction.options.getString('username').toLowerCase().replace('@', '');

      await interaction.deferReply();

      const embed = await fetchInstagramProfile(username, interaction.user);
      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, interaction);
      const errorMessage = error.message || 'An error occurred while fetching the Instagram profile';
      return embeds.deny(interaction, errorMessage);
    }
  }
}
