const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { getService } = require('@services');
const { getGuildPrefix, runHelpCommand } = require('../../utils/commandProcessor');
const { findUser } = require('../../handlers/finder');
const { handleSpotifyError, checkSpotifyAccess, checkActiveDevices } = require('../../handlers/spotifyHelpers');

module.exports = {
  name: "play",
  aliases: [],
  description: 'Play a song on your Spotify',
  syntax: 'play (song name/spotify link/@user)',
  example: 'play @vwsn',
  run: async(client, message, args) => {
    const spotifyService = getService('spotify');
    const guildprefix = await getGuildPrefix(message.guild.id);

    if (!args[0]) {
      return runHelpCommand(message, 'play');
    }

    try {
      // Check if requesting user has linked Spotify
      const { isLinked, accessToken } = await checkSpotifyAccess(message);
      if (!isLinked || !accessToken) return;

      // Check for active devices
      const devices = await checkActiveDevices(message, accessToken);
      if (!devices) return;

      const firstArg = args[0];
      
      // Check if it's a user mention
      if (firstArg.startsWith('<@') && firstArg.endsWith('>')) {
        return await playFromUser(client, message, args, spotifyService, accessToken);
      }
      
      // Check if it's a Spotify link
      if (firstArg.includes('spotify.com/') || firstArg.startsWith('spotify:')) {
        return await playFromSpotifyLink(message, args, spotifyService, accessToken);
      }
      
      // Otherwise, search by query (song name or artist)
      return await playBySearch(message, args, spotifyService, accessToken);

    } catch (error) {
      console.error('[Play Command] Error:', error);
      return handleSpotifyError(message, error);
    }
  }
};

/**
 * Play from a Spotify link (track, album, or playlist)
 */
async function playFromSpotifyLink(message, args, spotifyService, accessToken) {
  try {
    const link = args[0];
    await message.channel.sendTyping();

    // Parse Spotify URI/URL
    let uri = link;
    if (link.includes('spotify.com/')) {
      // Convert URL to URI
      const match = link.match(/spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
      if (!match) {
        return embeds.warn(message, 'Invalid **Spotify** link. Please provide a track, album, or playlist link.');
      }
      uri = `spotify:${match[1]}:${match[2]}`;
    }

    // Validate URI format
    if (!uri.match(/^spotify:(track|album|playlist):[a-zA-Z0-9]+$/)) {
      return embeds.warn(message, 'Invalid **Spotify** URI format.');
    }

    const [, type, id] = uri.split(':');

    // Start playback based on type
    if (type === 'track') {
      await spotifyService.startPlayback(uri, accessToken);
      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setDescription(`${config.emojis.musicNote} ${message.author}: Now playing track from **Spotify** link`);
      return message.channel.send({ embeds: [embed] });
    } else if (type === 'album' || type === 'playlist') {
      // For albums and playlists, use context_uri
      const axios = require('axios');
      await axios.put(
        'https://api.spotify.com/v1/me/player/play',
        { context_uri: uri },
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const typeLabel = type === 'album' ? 'album' : 'playlist';
      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setDescription(`${config.emojis.musicNote} ${message.author}: Now playing **Spotify** ${typeLabel}`);
      return message.channel.send({ embeds: [embed] });
    }

  } catch (error) {
    throw error;
  }
}

/**
 * Play by searching for a song or artist
 */
async function playBySearch(message, args, spotifyService, accessToken) {
  try {
    const query = args.join(' ');
    await message.channel.sendTyping();

    // Search for tracks
    const tracks = await spotifyService.searchTrack(query, accessToken);

    if (!tracks || tracks.length === 0) {
      return embeds.warn(message, `No tracks found for **${query}**`);
    }

    const track = tracks[0]; // Use first result

    // Start playback
    await spotifyService.startPlayback(track.uri, accessToken);

    // Send success message
    const trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
    const trackName = track.name;
    const artistName = track.artists.map(a => a.name).join(', ');
    
    const embed = new EmbedBuilder()
      .setColor(config.colors.embed)
      .setDescription(
        `${config.emojis.musicNote} ${message.author}: Now playing [\`${trackName}\`](${trackUrl}) by \`${artistName}\``
      );

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    throw error;
  }
}

/**
 * Play the track that another user is currently listening to
 */
async function playFromUser(client, message, args, spotifyService, accessToken) {
  try {
    // Parse user mention
    const userResult = await findUser(message.guild, args[0], client);
    
    if (!userResult.found) {
      return embeds.warn(message, userResult.error || 'User not found.');
    }

    const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
    let trackUri = null;
    let trackName = null;
    let artistName = null;
    let trackUrl = null;

    // Check if target user has linked Spotify
    const isTargetLinked = await spotifyService.isLinked(targetUser.id);
    
    if (isTargetLinked) {
      // Try to get from linked Spotify account
      await message.channel.sendTyping();

      const targetAccessToken = await spotifyService.getAccessToken(targetUser.id);
      
      if (targetAccessToken) {
        const currentlyPlaying = await spotifyService.getCurrentlyPlaying(targetAccessToken);

        if (currentlyPlaying && currentlyPlaying.item) {
          const track = currentlyPlaying.item;
          trackUri = track.uri;
          trackName = track.name;
          artistName = track.artists.map(a => a.name).join(', ');
          trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
        }
      }
    }

    // Fallback: Check Discord presence for Spotify activity
    if (!trackUri) {
      await message.channel.sendTyping();
      
      // Fetch the guild member to get fresh presence data
      const member = await message.guild.members.fetch(targetUser.id);
      const spotifyActivity = member.presence?.activities?.find(activity => activity.name === 'Spotify' && activity.type === 2);

      if (!spotifyActivity) {
        return embeds.warn(message, `**${targetUser.username}** isn't listening to any **music** right now!`);
      }

      // Extract track info from presence
      trackName = spotifyActivity.details; // Song name
      artistName = spotifyActivity.state; // Artist name
      const trackId = spotifyActivity.syncId; // Spotify track ID
      
      if (!trackId) {
        return embeds.warn(message, `Could not get track information from **${targetUser.username}**'s Spotify status.`);
      }

      trackUri = `spotify:track:${trackId}`;
      trackUrl = `https://open.spotify.com/track/${trackId}`;
    }

    // Start playback on requesting user's device
    await spotifyService.startPlayback(trackUri, accessToken);

    // Send success message
    const embed = new EmbedBuilder()
      .setColor(config.colors.spotify)
      .setDescription(
        `${config.emojis.spotify} ${message.author}: Now playing [\`${trackName}\`](${trackUrl}) by \`${artistName}\` (from **${targetUser.username}**'s Spotify)`
      );

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    throw error;
  }
}
