const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const config = require('../../../config/setup');
const { getService } = require('@services');
const { getGuildPrefix } = require('../../../utils/commandProcessor');
const { findUser } = require('../../../handlers/finder');

module.exports = {
  name: "fm",
  aliases: ['np'],
  description: 'Show your current or last played track from Last.fm',
  syntax: 'fm (user)',
  example: 'fm @vwsn',
  run: async(client, message, args) => {
    const userService = getService('user');
    const guildprefix = await getGuildPrefix(message.guild.id);

    let targetUser = message.author;
    let targetUserId = message.author.id;

    // Check if user specified another user
    if (args[0]) {
      const userResult = await findUser(message.guild, args[0], client);

      if (!userResult.found) {
        return embeds.warn(message, userResult.error);
      }

      // Get the User object (not GuildMember)
      targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
      targetUserId = targetUser.id;
    }

    const fmuser = await userService.getLastFMUsername(targetUserId);

    if (!fmuser) {
      const isOwnProfile = targetUserId === message.author.id;
      const pronoun = isOwnProfile ? 'You' : `**${targetUser.displayName || targetUser.username || 'User'}**`;
      const verb = isOwnProfile ? "don't" : "doesn't";
      return embeds.warn(message, `${pronoun} ${verb} have a **Last.fm** username set`);
    }

    try {
      // Get recent tracks
      const recentTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(fmuser)}&api_key=${config.apis.lastfm}&format=json&limit=1&extended=1`;

      const recentResponse = await fetch(recentTracksUrl);

      if (!recentResponse.ok) {
        throw new Error(`Last.fm API returned ${recentResponse.status}`);
      }

      const recentData = await recentResponse.json();

      if (recentData.error) {
        if (recentData.error === 6) {
          return embeds.warn(message, `The **Last.fm** user **${fmuser}** doesn't exist`);
        }
        throw new Error(`Last.fm API error: ${recentData.message}`);
      }

      if (!recentData.recenttracks || !recentData.recenttracks.track || recentData.recenttracks.track.length === 0) {
        return embeds.warn(message, `**${fmuser}** hasn't played any tracks recently`);
      }

      const track = recentData.recenttracks.track[0];

      const trackName = track.name;
      const artistName = track.artist.name;
      const trackImage = track.image[3]['#text'] || track.image[2]['#text'] || '';
      const isNowPlaying = track['@attr'] && track['@attr'].nowplaying;

      // Get track info for play count
      let playCount = '0';
      try {
        const trackInfoUrl = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&username=${encodeURIComponent(fmuser)}&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&api_key=${config.apis.lastfm}&format=json&autocorrect=1`;

        const trackResponse = await fetch(trackInfoUrl);
        if (trackResponse.ok) {
          const trackData = await trackResponse.json();
          if (trackData.track && trackData.track.userplaycount) {
            playCount = trackData.track.userplaycount;
          }
        }
      } catch (error) {

        // Continue with playCount = '0'
      }

      // Get artist info for artist play count
      let artistPlayCount = '0';
      try {
        const artistInfoUrl = `https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&username=${encodeURIComponent(fmuser)}&artist=${encodeURIComponent(artistName)}&api_key=${config.apis.lastfm}&format=json&autocorrect=1`;

        const artistResponse = await fetch(artistInfoUrl);
        if (artistResponse.ok) {
          const artistData = await artistResponse.json();
          if (artistData.artist && artistData.artist.stats && artistData.artist.stats.userplaycount) {
            artistPlayCount = artistData.artist.stats.userplaycount;
          }
        }
      } catch (error) {

        // Continue with artistPlayCount = '0'
      }

      // Format numbers with commas
      const formatNumber = (num) => {
        return parseInt(num).toLocaleString();
      };

      // Create Last.fm URLs
      const trackUrl = `https://www.last.fm/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(trackName)}`;
      const artistUrl = `https://www.last.fm/music/${encodeURIComponent(artistName)}`;
      const userUrl = `https://www.last.fm/user/${encodeURIComponent(fmuser)}`;

      // Status indicator
      const statusText = isNowPlaying ? 'Now Playing' : 'Last Played';

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setAuthor({
          name: `${statusText} - ${targetUser.displayName || targetUser.username || 'User'}`,
          iconURL: targetUser.displayAvatarURL({ dynamic: true }),
          url: userUrl
        })
        .setDescription(`**[${trackName}](${trackUrl})** - \`${formatNumber(playCount)} ${playCount === '1' ? 'play' : 'plays'}\`\n> by ${artistName}`);

      if (trackImage) {
        embed.setThumbnail(trackImage);
      }

      const messageOptions = {
        embeds: [embed]
      };

      const sentMessage = await message.channel.send(messageOptions);

    } catch (error) {


      if (error.message.includes('doesn\'t exist')) {
        return embeds.warn(message, `The **Last.fm** user **${fmuser}** doesn't exist`);
      }

      return embeds.warn(message, `**Last.fm** service is currently unavailable, please try again later. For updates, check [@lastfmstatus](https://twitter.com/lastfmstatus)`);
    }
  }
}