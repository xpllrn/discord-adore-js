const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { getService } = require('@services');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { findUser } = require('../../handlers/finder');
const { handleSpotifyError, checkSpotifyAccess } = require('../../handlers/spotifyHelpers');

module.exports = {
  name: "sp",
  aliases: [],
  description: 'Get Spotify links for songs, artists, or what a user is currently playing',
  syntax: 'sp (song name/artist name/@user)',
  example: 'sp @vwsn',
  run: async(client, message, args) => {
    const spotifyService = getService('spotify');

    if (!args[0]) {
      return runHelpCommand(message, 'sp');
    }

    try {
      const firstArg = args[0];
      
      // Check if it's a user mention
      if (firstArg.startsWith('<@') && firstArg.endsWith('>')) {
        return await getLinkFromUser(client, message, args, spotifyService);
      }
      
      // Otherwise, search by query (song name or artist)
      return await getLinkBySearch(message, args, spotifyService);

    } catch (error) {
      console.error('[SP Command] Error:', error);
      return handleSpotifyError(message, error);
    }
  }
};

/**
 * Get Spotify link by searching for a song or artist
 */
async function getLinkBySearch(message, args, spotifyService) {
  try {
    const query = args.join(' ');
    await message.channel.sendTyping();

    // Check if requesting user has linked Spotify for search access
    const { isLinked, accessToken } = await checkSpotifyAccess(message);
    if (!isLinked || !accessToken) return;

    // Search for tracks
    const tracks = await spotifyService.searchTrack(query, accessToken);

    if (!tracks || tracks.length === 0) {
      return embeds.warn(message, `No tracks found for **${query}**`);
    }

    const track = tracks[0]; // Use first result

    // Get track details
    const trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
    const trackName = track.name;
    const artistName = track.artists.map(a => a.name).join(', ');
    const albumName = track.album?.name || 'Unknown Album';
    const albumImage = track.album?.images?.[0]?.url;
    
    const embed = new EmbedBuilder()
      .setColor(config.colors.embed)
      .setAuthor({
        name: 'Spotify Track Link',
        iconURL: 'https://cdn.discordapp.com/attachments/1044688839005966396/1044689071773454336/spotify.png'
      })
      .setTitle(`${trackName}`)
      .setURL(trackUrl)
      .setDescription(`**Artist:** ${artistName}\n**Album:** ${albumName}`)
      .setFooter({
        text: `Requested by ${message.author.username}`,
        iconURL: message.author.displayAvatarURL()
      });

    if (albumImage) {
      embed.setThumbnail(albumImage);
    }

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    throw error;
  }
}

/**
 * Get Spotify link for what another user is currently listening to
 */
async function getLinkFromUser(client, message, args, spotifyService) {
  try {
    // Parse user mention
    const userResult = await findUser(message.guild, args[0], client);
    
    if (!userResult.found) {
      return embeds.warn(message, userResult.error || 'User not found.');
    }

    const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
    let trackData = null;

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
          trackData = {
            name: track.name,
            artists: track.artists.map(a => a.name).join(', '),
            album: track.album?.name || 'Unknown Album',
            url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
            image: track.album?.images?.[0]?.url,
            id: track.id
          };
        }
      }
    }

    // Fallback: Check Discord presence for Spotify activity
    if (!trackData) {
      await message.channel.sendTyping();
      
      // Fetch the guild member to get fresh presence data
      const member = await message.guild.members.fetch(targetUser.id);
      const spotifyActivity = member.presence?.activities?.find(activity => activity.name === 'Spotify' && activity.type === 2);

      if (!spotifyActivity) {
        return embeds.warn(message, `**${targetUser.username}** isn't listening to any **music** right now!`);
      }

      // Extract track info from presence
      const trackName = spotifyActivity.details; // Song name
      const artistName = spotifyActivity.state; // Artist name
      const trackId = spotifyActivity.syncId; // Spotify track ID
      const albumName = spotifyActivity.assets?.largeText || 'Unknown Album';
      const albumImage = spotifyActivity.assets?.largeImage ? 
        `https://i.scdn.co/image/${spotifyActivity.assets.largeImage.slice(8)}` : null;
      
      if (!trackId) {
        return embeds.warn(message, `Could not get track information from **${targetUser.username}**'s Spotify status.`);
      }

      trackData = {
        name: trackName,
        artists: artistName,
        album: albumName,
        url: `https://open.spotify.com/track/${trackId}`,
        image: albumImage,
        id: trackId
      };
    }

    // Create embed with track link
    const embed = new EmbedBuilder()
      .setColor(config.colors.embed)
      .setAuthor({
        name: `${targetUser.username}'s Current Track`,
        iconURL: targetUser.displayAvatarURL()
      })
      .setTitle(`${trackData.name}`)
      .setURL(trackData.url)
      .setDescription(`**Artist:** ${trackData.artists}\n**Album:** ${trackData.album}`)
      .setFooter({
        text: `Requested by ${message.author.username}`,
        iconURL: message.author.displayAvatarURL()
      });

    if (trackData.image) {
      embed.setThumbnail(trackData.image);
    }

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    throw error;
  }
}