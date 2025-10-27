const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { getService } = require('@services');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { handleSpotifyError, checkSpotifyAccess, checkActiveDevices } = require('./spotifyHelpers');

module.exports = {
  name: "queue",
  aliases: ["q"],
  description: 'Add a song to your Spotify queue',
  usage: '{guildprefix}queue [song name]\n{guildprefix}queue [spotify link]',
  run: async(client, message, args) => {
    const spotifyService = getService('spotify');

    if (!args[0]) {
      return runHelpCommand(message, 'queue');
    }

    try {
      // Check if requesting user has linked Spotify
      const { isLinked, accessToken } = await checkSpotifyAccess(message);
      if (!isLinked || !accessToken) return;

      // Check for active devices
      const devices = await checkActiveDevices(message, accessToken);
      if (!devices) return;

      const firstArg = args[0];
      
      // Check if it's a Spotify link
      if (firstArg.includes('spotify.com/') || firstArg.startsWith('spotify:')) {
        return await queueFromSpotifyLink(message, args, spotifyService, accessToken);
      }
      
      // Otherwise, search by query
      return await queueBySearch(message, args, spotifyService, accessToken);

    } catch (error) {
      console.error('[Queue Command] Error:', error);
      return handleSpotifyError(message, error);
    }
  }
};

/**
 * Add track to queue from Spotify link
 */
async function queueFromSpotifyLink(message, args, spotifyService, accessToken) {
  try {
    const link = args[0];
    await message.channel.sendTyping();

    // Parse Spotify URI/URL
    let uri = link;
    if (link.includes('spotify.com/')) {
      // Convert URL to URI
      const match = link.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
      if (!match) {
        return embeds.warn(message, 'Invalid **Spotify** track link. Queue only supports individual tracks.');
      }
      uri = `spotify:track:${match[1]}`;
    }

    // Validate URI format (only tracks can be queued)
    if (!uri.match(/^spotify:track:[a-zA-Z0-9]+$/)) {
      return embeds.warn(message, 'Queue only supports individual tracks. Please provide a track link.');
    }

    // Add to queue
    const axios = require('axios');
    await axios.post(
      `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}`,
      {},
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const embed = new EmbedBuilder()
      .setColor(config.colors.embed)
      .setDescription(`${config.emojis.success} ${message.author}: Added track to your **Spotify** queue`);
    
    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    throw error;
  }
}

/**
 * Add track to queue by searching
 */
async function queueBySearch(message, args, spotifyService, accessToken) {
  try {
    const query = args.join(' ');
    await message.channel.sendTyping();

    // Search for tracks
    const tracks = await spotifyService.searchTrack(query, accessToken);

    if (!tracks || tracks.length === 0) {
      return embeds.warn(message, `No tracks found for **${query}**`);
    }

    const track = tracks[0]; // Use first result

    // Add to queue
    const axios = require('axios');
    await axios.post(
      `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(track.uri)}`,
      {},
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    // Send success message
    const trackUrl = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
    const trackName = track.name;
    const artistName = track.artists.map(a => a.name).join(', ');
    
    const embed = new EmbedBuilder()
      .setColor(config.colors.embed)
      .setDescription(
        `${config.emojis.success} ${message.author}: Added [\`${trackName}\`](${trackUrl}) by \`${artistName}\` to your queue`
      );

    return message.channel.send({ embeds: [embed] });

  } catch (error) {
    throw error;
  }
}
