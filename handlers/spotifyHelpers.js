const { EmbedBuilder } = require("discord.js");
const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const { getService } = require('@services');

/**
 * Check if user is linked and get access token
 * @param {Message} message - Discord message
 * @returns {Promise<{isLinked: boolean, accessToken: string|null}>}
 */
async function checkSpotifyAccess(message) {
  const spotifyService = getService('spotify');

  const isLinked = await spotifyService.isLinked(message.author.id);

  if (!isLinked) {
    embeds.warn(message, 'You haven\'t linked your **Spotify** account. Use `,spotify login` to get started.');
    return { isLinked: false, accessToken: null };
  }

  const accessToken = await spotifyService.getAccessToken(message.author.id);

  if (!accessToken) {
    embeds.warn(message, 'Failed to get **Spotify** access token.');
    return { isLinked: true, accessToken: null };
  }

  return { isLinked: true, accessToken };
}

/**
 * Check for active Spotify devices
 * @param {Message} message - Discord message
 * @param {string} accessToken - Spotify access token
 * @returns {Promise<Array|null>} Array of devices or null if none found
 */
async function checkActiveDevices(message, accessToken) {
  const spotifyService = getService('spotify');
  const devices = await spotifyService.getActiveDevices(accessToken);

  if (!devices || devices.length === 0) {
    embeds.warn(message, 'No active **Spotify** device found. Please open Spotify on a device first.');
    return null;
  }

  return devices;
}

/**
 * Handle Spotify service errors with user-friendly messages
 * @param {Message} message - Discord message
 * @param {Error} error - Error object
 */
function handleSpotifyError(message, error) {
  const errorCode = error.message || error.code;

  if (errorCode === 'NO_ACTIVE_DEVICE') {
    return embeds.warn(message, 'No active **Spotify** device found. Please open Spotify on a device first.');
  }

  if (errorCode === 'PREMIUM_REQUIRED') {
    return embeds.warn(message, '**Spotify Premium** is required for this feature.');
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
  checkSpotifyAccess,
  checkActiveDevices,
  handleSpotifyError
};
