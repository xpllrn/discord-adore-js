const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { createPagination } = require('../../core/buttons');
const config = require('../../config/setup');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { fetch } = require('undici');

module.exports = {
  name: "instagram",
  aliases: ['ig', 'insta'],
  description: 'view Instagram profiles and stories',
  isGroupCommand: true,
  run: async(client, message, args) => {

    if (!args[0]) {
      return runHelpCommand(message, 'instagram');
    }

    // Check if first arg is a subcommand
    const subcommand = args[0].toLowerCase();

    if (subcommand === 'story' || subcommand === 'stories') {
      const subcommandInfo = {
        description: 'View Instagram stories for a user',
        usage: '{guildprefix}instagram story [username]',
        aliases: ['stories'],
        parameters: ['username'],
        example: '{guildprefix}instagram story cristiano'
      };

      if (!args[1]) {
        return runHelpCommand(message, 'instagram');
      }

      const username = String(args[1]).toLowerCase().replace('@', '');
      return await handleStoryCommand(client, message, username);
    }

    // Default: View profile
    const username = String(args[0]).toLowerCase().replace('@', '');
    return await handleProfileCommand(client, message, username);
  }
}

async function handleProfileCommand(client, message, username) {
  try {
    message.channel.sendTyping();

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
      return embeds.warn(message, `Instagram profile **${username}** was not found.`);
    }

    const results = await response.json();

    if (!results.data || !results.data.user) {
      return embeds.warn(message, `Instagram profile **${username}** was not found`);
    }

    const user = results.data.user;
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

    if (hasStories) {
      embed.setFooter({ text: `Use 'instagram story ${username}' to view their stories` });
    }

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    return embeds.warn(message, `Failed to fetch Instagram profile for **${username}**. Please try again later.`);
  }
}


async function handleStoryCommand(client, message, username) {
  try {
    message.channel.sendTyping();

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
      return embeds.warn(message, `Instagram profile **${username}** was not found.`);
    }

    const results = await response.json();

    if (!results.data || !results.data.user) {
      return embeds.warn(message, `Instagram profile **${username}** was not found`);
    }

    const user = results.data.user;
    return await fetchStories(client, message, user);

  } catch (error) {
    return embeds.warn(message, `Failed to fetch Instagram profile for **${username}**. Please try again later.`);
  }
}

async function fetchStories(client, message, user) {
  try {
    if (!user.has_public_story) {
      return embeds.warn(message, `**${user.username}** doesn't have any **ctive stories**.`);
    }

    const storiesResponse = await fetch(`https://i.instagram.com/api/v1/feed/user/${user.id}/story/`, {
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

    if (!storiesResponse.ok) {
      return embeds.warn(message, `Unable to fetch stories for **${user.username}**. They may be private or unavailable.`);
    }

    const storiesData = await storiesResponse.json();

    if (!storiesData.reel || !storiesData.reel.items || storiesData.reel.items.length === 0) {
      return embeds.warn(message, `**${user.username}** doesn't have any active stories.`);
    }

    const stories = storiesData.reel.items;

    const formatPage = (pageStories, currentPage, totalPages) => {
      const story = pageStories[0];
      
      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setAuthor({
          name: `${user.username}'s Story`,
          iconURL: user.profile_pic_url,
          url: `https://www.instagram.com/${user.username}`
        })
        .setFooter({ text: `Story ${currentPage} of ${totalPages} • Posted` })
        .setTimestamp(story.taken_at * 1000);

      if (story.video_versions && story.video_versions.length > 0) {
        embed.setDescription('📹 Video Story');
        embed.setImage(story.image_versions2?.candidates?.[0]?.url || null);
        embed.addFields([
          {
            name: 'Video URL',
            value: `[Click to view video](${story.video_versions[0].url})`,
            inline: false
          }
        ]);
      } else if (story.image_versions2?.candidates) {
        embed.setDescription('📷 Photo Story');
        embed.setImage(story.image_versions2.candidates[0].url);
      }

      return embed;
    };

    await createPagination(message, stories, formatPage, 1, `${user.username}'s Stories`);

  } catch (error) {
    return embeds.warn(message, `Failed to fetch stories for **${user.username}**. Please try again later.`);
  }
}
