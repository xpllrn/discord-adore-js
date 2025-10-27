const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { getService } = require('@services');
const { getGuildPrefix, runHelpCommand } = require('../../utils/commandProcessor');
const { findUser } = require('../../handlers/finder');

/**
 * Handle Spotify service errors with user-friendly messages
 */
function handleSpotifyError(message, error) {
  const errorCode = error.message || error.code;
  
  if (errorCode === 'NO_ACTIVE_DEVICE') {
    const embed = new EmbedBuilder()
      .setColor(config.colors.warn)
      .setDescription(`${config.emojis.warn} No active **Spotify** device found. Please open Spotify on a device first.`);
    return message.channel.send({ embeds: [embed] });
  }
  
  if (errorCode === 'PREMIUM_REQUIRED') {
    const embed = new EmbedBuilder()
      .setColor(config.colors.warn)
      .setDescription(`${config.emojis.warn} **Spotify Premium** is required for this feature.`);
    return message.channel.send({ embeds: [embed] });
  }
  
  if (errorCode === 'TOKEN_EXPIRED') {
    return embeds.warn(message, 'Your **Spotify** session expired. Please run `,spotify login` again.');
  }
  
  if (errorCode === 'PLAYBACK_ERROR') {
    return embeds.warn(message, 'Failed to control playback. Make sure **Spotify** is open on a device.');
  }
  
  // Default error
  return embeds.warn(message, error.message || 'An error occurred with **Spotify**.');
}

module.exports = {
  name: "play",
  aliases: [],
  description: 'Play a song on your Spotify',
  usage: '{guildprefix}play [song name]\n{guildprefix}play [@user]',
  run: async(client, message, args) => {
    const spotifyService = getService('spotify');
    const guildprefix = await getGuildPrefix(message.guild.id);

    if (!args[0]) {
      return runHelpCommand(message, 'play');
    }

    try {
      // Check if requesting user has linked Spotify
      const isLinked = await spotifyService.isLinked(message.author.id);
      
      if (!isLinked) {
        return embeds.warn(message, 'You haven\'t linked your Spotify account. Use `' + guildprefix + 'spotify link` to get started.');
      }

      // Check if first argument is a user mention
      const firstArg = args[0];
      const isMention = firstArg.startsWith('<@') && firstArg.endsWith('>');

      if (isMention) {
        // Play from another user's currently playing track
        await playFromUser(client, message, args, spotifyService, guildprefix);
      } else {
        // Play by song name
        await playBySongName(client, message, args, spotifyService);
      }

    } catch (error) {
      console.error('[Play Command] Error:', error);
      return handleSpotifyError(message, error);
    }
  }
};

/**
 * Play a song by searching for it
 */
async function playBySongName(client, message, args, spotifyService) {
  try {
    const query = args.join(' ');
    
    // Show typing indicator
    await message.channel.sendTyping();

    // Get access token (auto-refreshes if needed)
    const accessToken = await spotifyService.getAccessToken(message.author.id);
    
    if (!accessToken) {
      return embeds.warn(message, 'Failed to get Spotify access token. Please try linking your account again.');
    }

    // Search for tracks
    const tracks = await spotifyService.searchTrack(query, accessToken);

    if (!tracks || tracks.length === 0) {
      return embeds.warn(message, `No tracks found for **${query}**`);
    }

    const track = tracks[0]; // Use first result

    // Check for active devices
    const devices = await spotifyService.getActiveDevices(accessToken);

    if (!devices || devices.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(config.colors.warn)
        .setDescription(`${config.emojis.warn} No active **Spotify** device found. Please open Spotify on a device first.`);
      return message.channel.send({ embeds: [embed] });
    }

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
async function playFromUser(client, message, args, spotifyService, guildprefix) {
  try {
    // Parse user mention
    const userResult = await findUser(message.guild, args[0], client);
    
    if (!userResult.found) {
      return embeds.warn(message, userResult.error || 'User not found.');
    }

    const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;

    // Check if target user has linked Spotify
    const isTargetLinked = await spotifyService.isLinked(targetUser.id);
    
    if (!isTargetLinked) {
      return embeds.warn(message, `**${targetUser.tag}** hasn't linked their Spotify account.`);
    }

    // Show typing indicator
    await message.channel.sendTyping();

    // Get target user's access token
    const targetAccessToken = await spotifyService.getAccessToken(targetUser.id);
    
    if (!targetAccessToken) {
      return embeds.warn(message, `Failed to get Spotify access for **${targetUser.tag}**.`);
    }

    // Get target user's currently playing track
    const currentlyPlaying = await spotifyService.getCurrentlyPlaying(targetAccessToken);

    if (!currentlyPlaying || !currentlyPlaying.item) {
      return embeds.warn(message, `**${targetUser.tag}** is not currently playing anything on Spotify.`);
    }

    const track = currentlyPlaying.item;

    // Get requesting user's access token
    const accessToken = await spotifyService.getAccessToken(message.author.id);
    
    if (!accessToken) {
      return embeds.warn(message, 'Failed to get your Spotify access token. Please try linking your account again.');
    }

    // Check for active devices
    const devices = await spotifyService.getActiveDevices(accessToken);

    if (!devices || devices.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(config.colors.warn)
        .setDescription(`${config.emojis.warn} No active **Spotify** device found. Please open Spotify on a device first.`);
      return message.channel.send({ embeds: [embed] });
    }

    // Start playback on requesting user's device
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
