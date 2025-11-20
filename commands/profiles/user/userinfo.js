const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { embeds } = require('../../../core/embeds');
const config = require('../../../config/setup');
const { getService } = require('@services');
const { findUser } = require('../../../handlers/finder');

module.exports = {
  name: "userinfo",
  aliases: ['lookup', 'whois', 'ui'],
  description: "Get information about a Discord user",
  syntax: 'userinfo (user)',
  example: 'userinfo @vwsn',
  run: async (client, message, args) => {

    let targetUser = null;
    let isGlobalUser = false;

    // If no arguments provided, show info for message author
    if (!args[0]) {
      targetUser = message.member;
    } else {
      // Use universal finder to get user
      const userResult = await findUser(message.guild, args[0], client);

      if (!userResult.found) {
        return embeds.warn(message, userResult.error);
      }

      targetUser = userResult.user;
      isGlobalUser = userResult.isGlobal;
    }

    // Extract user and member data
    let user, member;
    if (isGlobalUser) {
      user = targetUser;
      member = null;
    } else {
      user = targetUser.user || targetUser;
      member = targetUser;
    }

    // Create account creation timestamp (Discord timestamp format)
    const createdTimestamp = Math.floor(user.createdTimestamp / 1000);
    const createdTime = `<t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)`;

    // Build embed description
    let description = `> **Created**: ${createdTime}`;

    // Add join date if user is in the guild
    if (member && member.joinedTimestamp) {
      const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);
      const joinedTime = `<t:${joinedTimestamp}:F> (<t:${joinedTimestamp}:R>)`;
      description += `\n> **Joined**: ${joinedTime}`;
    }

    // Add booster date if user is boosting
    if (member && member.premiumSince) {
      const boosterTimestamp = Math.floor(member.premiumSince.getTime() / 1000);
      const boosterTime = `<t:${boosterTimestamp}:F> (<t:${boosterTimestamp}:R>)`;
      description += `\n> **Booster**: ${boosterTime}`;
    }

    // Calculate mutual servers
    const mutualServers = client.guilds.cache.filter(guild => guild.members.cache.has(user.id));
    const mutualCount = mutualServers.size;

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setAuthor({
        name: `${user.username} (${user.id})`,
      })
      .setThumbnail(user.displayAvatarURL({ size: 512, dynamic: true }))
      .setDescription(description)
      .setFooter({
        text: `${mutualCount} mutual server${mutualCount === 1 ? '' : 's'}`,
        iconURL: client.user.displayAvatarURL({ dynamic: true })
      });

    // Add roles field if user is in guild
    if (member && member.roles) {
      let roles = member.roles.cache
        .filter(role => role.name !== '@everyone')
        .map(role => role.toString())
        .slice(0, 10); // Limit to 10 roles

      if (roles.length > 0) {
        if (member.roles.cache.size > 11) { // 10 + @everyone
          roles.push(`... and ${member.roles.cache.size - 11} more`);
        }

        embed.addFields({
          name: `**Roles (${member.roles.cache.size - 1})**`,
          value: roles.join(' '),
          inline: false
        });
      }
    }


    const sentMessage = await message.channel.send({
      embeds: [embed]
    });

    checkLastFmNowPlaying(user, embed, sentMessage);
  }
};

async function checkLastFmNowPlaying(user, embed, sentMessage) {
  try {

    const fmuser = await userService.getLastFMUsername(user.id);

    if (!fmuser) {
      return;
    }

    const recentTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(fmuser)}&api_key=${config.apis.lastfm}&format=json&limit=1&extended=1`;

    const response = await fetch(recentTracksUrl);

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    if (data.error || !data.recenttracks || !data.recenttracks.track || data.recenttracks.track.length === 0) {
      return;
    }

    const track = data.recenttracks.track[0];

    // Check if currently playing
    if (!track['@attr'] || !track['@attr'].nowplaying) {
      return;
    }

    const trackName = track.name;
    const artistName = track.artist.name;

    // Create the Last.fm status line
    const lastfmEmoji = config.emojis.lastfm;
    const trackUrl = `https://www.last.fm/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(trackName)}`;
    const lastfmStatus = `${lastfmEmoji} Listening to **[${trackName}](${trackUrl})** by **${artistName}**`;

    const currentDescription = embed.data.description;
    const newDescription = `${lastfmStatus}\n\n${currentDescription}`;

    embed.setDescription(newDescription);

    await sentMessage.edit({
      embeds: [embed]
    });

  } catch (error) {
    // Silently fail on any errors to not disrupt the userinfo command

  }
}