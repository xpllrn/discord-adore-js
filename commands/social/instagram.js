const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { fetch } = require('undici');

module.exports = {
  name: "instagram",
  aliases: ['ig', 'insta'],
  description: 'Get information about an Instagram profile',
  syntax: 'instagram (username)',
  example: 'instagram @cristiano',
  run: async(client, message, args) => {

    if (!args[0]) {
      return runHelpCommand(message, 'instagram');
    }

    const username = String(args[0]).toLowerCase().replace('@', '');

    try {
      message.channel.sendTyping();

      // Using Instagram's public web endpoint (no auth required)
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
        return embeds.warn(message, `Instagram profile **${username}** was not found or the service is temporarily unavailable.`);
      }

      const results = await response.json();

      if (!results.data || !results.data.user) {
        return embeds.warn(message, `Instagram profile **${username}** was not found`);
      }

      const user = results.data.user;

      // Check for stories
      const hasStories = user.has_public_story || false;
      const storyStatus = hasStories ? '📖 Has active stories' : 'No active stories';

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setAuthor({
          name: message.member.displayName,
          iconURL: message.member.displayAvatarURL({ dynamic: true })
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
          },
          {
            name: 'Stories',
            value: storyStatus,
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

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      return embeds.warn(message, `Failed to fetch Instagram profile for **${username}**. Please try again later.`);
    }
  }
}
