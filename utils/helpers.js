/**
 * Command Helpers
 * Combined helper functions for various command features
 */

const fetch = require('node-fetch');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { colors } = require('../config/setup');
const { embeds } = require('../core/embeds');
const { getService } = require('@services');
const { findUser } = require('../handlers/finder');

// ===== SHARED UTILITIES =====

/**
 * Convert a number to its ordinal form (1st, 2nd, 3rd, etc.)
 * @param {number} num - The number to convert
 * @returns {string} The ordinal form of the number
 */
function getOrdinal(num) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = num % 100;
  return num + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
}

// ===== ROLEPLAY HELPERS =====

/**
 * Fetch a GIF from multiple APIs with fallback support
 * @param {string} action - The action type (hug, kiss, pat, etc.)
 * @returns {Promise<string>} The GIF URL
 */
async function fetchWaifuGif(action) {
  const actionMap = {
    'bonk': 'bonk', 'bully': 'bully', 'bite': 'bite', 'glomp': 'glomp',
    'slap': 'slap', 'kill': 'kill', 'poke': 'poke', 'punch': 'punch',
    'yeet': 'yeet', 'angry': 'angry', 'lick': 'lick', 'hug': 'hug',
    'cuddle': 'cuddle', 'kiss': 'kiss', 'pat': 'pat', 'headpat': 'pat',
    'tickle': 'tickle', 'nom': 'nom', 'smug': 'smug', 'blush': 'blush',
    'cry': 'cry', 'wave': 'wave', 'highfive': 'highfive', 'dance': 'dance',
    'stare': 'stare', 'facepalm': 'facepalm', 'sleep': 'sleep',
    'run': 'run', 'laugh': 'laugh', 'wink': 'wink'
  };

  const endpoint = actionMap[action] || action;
  const apiEndpoints = [
    `https://api.waifu.pics/sfw/${endpoint}`,
    `https://waifu.it/api/v4/${endpoint}`
  ];

  for (let i = 0; i < apiEndpoints.length; i++) {
    try {
      const response = await fetch(apiEndpoints[i]);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.log(`API ${i + 1} failed for ${action}:`, error.message);
      if (i === apiEndpoints.length - 1) {
        throw new Error(`Failed to fetch ${action} GIF from all APIs`);
      }
    }
  }
}

/**
 * Create a roleplay command function
 * @param {string} action - The action name (hug, kiss, pat, etc.)
 * @param {string} actionPastTense - The past tense of the action
 * @returns {Function} The command function
 */
function createRoleplayCommand(action, actionPastTense) {
  return async (client, message, args) => {
    try {
      let targetUser;
      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found || !userResult.user) {
          return message.channel.send({
            embeds: [new EmbedBuilder()
              .setColor(colors.error)
              .setDescription(`❌ <@${message.author.id}>: User not found!`)]
          });
        }
        targetUser = userResult.user;
      } else {
        targetUser = message.author;
      }

      const targetId = targetUser.id || (targetUser.user && targetUser.user.id);
      const actualUser = targetUser.user || targetUser;

      if (actualUser.id === message.guild.members.me.id) {
        return message.channel.send('Leave me alone!');
      }

      const gifUrl = await fetchWaifuGif(action);
      const targetUserId = targetId;
      const targetUsername = actualUser.username || 'Unknown';
      const userService = getService('user');

      const count = await userService.trackRoleplayInteraction(
        message.author.id,
        targetUserId,
        action
      );

      const reverseCount = await userService.getRoleplayCount(targetUserId, message.author.id, action);

      let description;
      if (targetUserId === message.author.id) {
        description = `<@${message.author.id}> ${actionPastTense} themselves`;
      } else {
        description = `<@${message.author.id}> ${actionPastTense} <@${targetUserId}> for the ${getOrdinal(count)} time!`;
      }

      let footerText = '';
      if (reverseCount > 0 && targetUserId !== message.author.id) {
        footerText = `${targetUsername} ${actionPastTense} ${message.author.username} ${reverseCount} times before`;
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setDescription(description)
        .setImage(gifUrl);

      if (footerText) {
        embed.setFooter({ text: footerText });
      }

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.log(`${action} command failed:`, error.message);
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(colors.error)
          .setDescription(`❌ <@${message.author.id}>: Failed to ${action}! Please try again.`)]
      });
    }
  };
}

/**
 * Get slash command data for roleplay commands
 * @param {string} name - Command name
 * @param {string} description - Command description
 * @returns {SlashCommandBuilder} Slash command builder
 */
function getRoleplaySlashData(name, description) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to target')
        .setRequired(false)
    );
}

/**
 * Execute a roleplay slash command
 * @param {string} action - The action name
 * @param {string} actionPastTense - The past tense of the action
 * @returns {Function} The execute function
 */
function executeRoleplaySlash(action, actionPastTense) {
  return async (interaction) => {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const author = interaction.user;

      if (targetUser.id === interaction.client.user.id) {
        return interaction.reply({ content: 'Leave me alone!', ephemeral: true });
      }

      // Defer reply since fetching GIF might take time
      await interaction.deferReply();

      const gifUrl = await fetchWaifuGif(action);
      const userService = getService('user');

      const count = await userService.trackRoleplayInteraction(
        author.id,
        targetUser.id,
        action
      );

      const reverseCount = await userService.getRoleplayCount(targetUser.id, author.id, action);

      let description;
      if (targetUser.id === author.id) {
        description = `<@${author.id}> ${actionPastTense} themselves`;
      } else {
        description = `<@${author.id}> ${actionPastTense} <@${targetUser.id}> for the ${getOrdinal(count)} time!`;
      }

      let footerText = '';
      if (reverseCount > 0 && targetUser.id !== author.id) {
        footerText = `${targetUser.username} ${actionPastTense} ${author.username} ${reverseCount} times before`;
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setDescription(description)
        .setImage(gifUrl);

      if (footerText) {
        embed.setFooter({ text: footerText });
      }

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.log(`${action} slash command failed:`, error.message);
      return embeds.deny(interaction, `Failed to ${action}! Please try again.`, true);
    }
  };
}

// ===== NSFW ROLEPLAY HELPERS =====

/**
 * Fetch a NSFW GIF from Purrbot API
 * @param {string} action - The action type (anal, blowjob, cum, etc.)
 * @returns {Promise<string>} The GIF URL
 */
async function fetchNSFWGif(action) {
  try {
    const response = await fetch(`https://api.purrbot.site/v2/img/nsfw/${action}/gif`);
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.message || 'API returned an error');
    return data.link;
  } catch (error) {
    console.log(`Purrbot API failed for ${action}:`, error.message);
    throw new Error(`Failed to fetch ${action} GIF from Purrbot API`);
  }
}

/**
 * Check if channel is NSFW or if guild has NSFW bypass enabled
 * @param {Object} channel - Discord channel object
 * @param {Object} guildData - Guild data from database (optional)
 * @returns {boolean} Whether the channel is NSFW or bypass is enabled
 */
function isNSFWChannel(channel, guildData = null) {
  // If channel is NSFW, always allow
  if (channel.nsfw === true) return true;

  // If guild has NSFW bypass enabled, allow in any channel
  if (guildData && guildData.NSFWBypass === true) return true;

  return false;
}

/**
 * Create a NSFW roleplay command function
 * @param {string} action - The action name
 * @param {string} actionPastTense - The past tense of the action
 * @returns {Function} The command function
 */
function createNSFWRoleplayCommand(action, actionPastTense) {
  return async (client, message, args) => {
    try {
      // Get guild data to check for NSFW bypass
      const guildService = getService('guild');
      const guildData = await guildService.ensureGuildData(message.guild.id);

      if (!isNSFWChannel(message.channel, guildData)) {
        return embeds.deny(message, 'This command can **only be used** in `NSFW` channels!');
      }

      let targetUser;
      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found || !userResult.user) {
          return embeds.deny(message, userResult.error);
        }
        targetUser = userResult.user;
      } else {
        targetUser = message.author;
      }

      const targetId = targetUser.id || (targetUser.user && targetUser.user.id);
      const actualUser = targetUser.user || targetUser;

      if (actualUser.id === message.guild.members.me.id) {
        return message.channel.send('Leave me alone!');
      }

      const gifUrl = await fetchNSFWGif(action);
      const targetUserId = targetId;
      const targetUsername = actualUser.username || 'Unknown';
      const userService = getService('user');

      const count = await userService.trackRoleplayInteraction(
        message.author.id,
        targetUserId,
        action
      );

      const reverseCount = await userService.getRoleplayCount(targetUserId, message.author.id, action);

      let description;
      if (targetUserId === message.author.id) {
        description = `<@${message.author.id}> ${actionPastTense} themselves`;
      } else {
        description = `<@${message.author.id}> ${actionPastTense} <@${targetUserId}> for the ${getOrdinal(count)} time!`;
      }

      let footerText = '';
      if (reverseCount > 0 && targetUserId !== message.author.id) {
        footerText = `${targetUsername} ${actionPastTense} ${message.author.username} ${reverseCount} times before`;
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setDescription(description)
        .setImage(gifUrl);

      if (footerText) {
        embed.setFooter({ text: footerText });
      }

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.log(`${action} command failed:`, error.message);
      return embeds.warn(message, `Failed to ${action}! Please try again.`);
    }
  };
}

// ===== SPOTIFY HELPERS =====

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
    embeds.warn(message, 'Failed to get **Spotify** access token. Please try linking your account again with `,spotify login`.');
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
    embeds.warn(message, '**Player command failed**: No `active device` found!');
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
    return embeds.warn(message, '**Player command failed**: No `active device` found!');
  }

  if (errorCode === 'PREMIUM_REQUIRED') {
    return embeds.warn(message, '**Premium** is required for **playback** feature.');
  }

  if (errorCode === 'TOKEN_EXPIRED') {
    return embeds.warn(message, 'Your **Spotify** session expired. Please run `,spotify login` again.');
  }

  if (errorCode === 'PLAYBACK_ERROR') {
    return embeds.warn(message, '**Player command failed**: No `active device` found!');
  }

  // Check if it's an authorization error (user not in beta list)
  if (errorCode.includes('403') || errorCode.includes('Forbidden') || errorCode.includes('unauthorized')) {
    const { EmbedBuilder } = require('discord.js');
    const config = require('../config/setup');

    const errorEmbed = new EmbedBuilder()
      .setColor(config.colors.error)
      .setDescription(
        `❌ ${message.author}: Your **Spotify account** is not approved for **adore** yet.\n\n` +
        `**Create a ticket** in the [\`support server\`](https://discord.gg/qsJMaTURqf) and provide your **Spotify email** to get added to the beta list.`
      );

    return message.channel.send({ embeds: [errorEmbed] });
  }

  return embeds.warn(message, error.message || 'An error occurred with **Spotify**.');
}

module.exports = {
  // Shared
  getOrdinal,

  // Roleplay
  fetchWaifuGif,
  createRoleplayCommand,
  getRoleplaySlashData,
  executeRoleplaySlash,

  // NSFW Roleplay
  fetchNSFWGif,
  isNSFWChannel,
  createNSFWRoleplayCommand,

  // Spotify
  checkSpotifyAccess,
  checkActiveDevices,
  handleSpotifyError
};
