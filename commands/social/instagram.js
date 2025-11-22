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

      console.log(`[Instagram] Fetching profile for: ${username}`);

      const response = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Instagram 76.0.0.15.395 Android (24/7.0; 640dpi; 1440x2560; samsung; SM-G930F; herolte; samsungexynos8890; en_US; 138226743)',
          'X-IG-App-ID': '936619743392459'
        }
      });

      console.log(`[Instagram] Response status: ${response.status}`);

      if (!response.ok) {
        console.error(`[Instagram] API error - Status: ${response.status}, StatusText: ${response.statusText}`);
        return embeds.warn(message, `Instagram API returned an error (${response.status}). The service may be temporarily unavailable.`);
      }

      const results = await response.json();
      console.log(`[Instagram] Response data:`, JSON.stringify(results).substring(0, 200));

      if (!results.data || !results.data.user) {
        console.error(`[Instagram] Profile not found or invalid response structure for: ${username}`);
        return embeds.warn(message, `Instagram profile **${username}** was not found`);
      }

      const user = results.data.user;

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

      console.log(`[Instagram] Successfully fetched profile for: ${username}`);
      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error(`[Instagram] Error fetching profile for ${username}:`, error);
      console.error(`[Instagram] Error stack:`, error.stack);
      return embeds.warn(message, `Failed to fetch Instagram profile for **${username}**. Error: ${error.message}`);
    }
  }
}
