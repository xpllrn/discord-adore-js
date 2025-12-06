/**
 * Command Helpers
 * Combined helper functions for various command features
 */

const fetch = require('node-fetch');
const { 
  EmbedBuilder, 
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');
const { colors } = require('../config/setup');

// ===== SAFE SEND UTILITIES =====

/**
 * Safely send a message to a channel, with fallback to DM if no permission
 * @param {Object} channel - Discord channel to send to
 * @param {Object} messageOptions - Message options (content, embeds, etc.)
 * @param {Object} user - User to DM if channel send fails (optional)
 * @param {Object} guild - Guild for context in DM (optional)
 * @returns {Promise<Message|null>} The sent message or null if failed
 */
async function safeSend(channel, messageOptions, user = null, guild = null) {
  try {
    // Check if bot has permission to send in this channel
    const botMember = channel.guild?.members?.me;
    if (botMember && !channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages)) {
      // No permission, try to DM user instead
      if (user) {
        return await safeDM(user, messageOptions, guild, channel);
      }
      return null;
    }

    return await channel.send(messageOptions);
  } catch (error) {
    // Handle specific Discord API errors
    if (error.code === 50013 || error.code === 50001) {
      // Missing Permissions or Missing Access - try DM
      if (user) {
        return await safeDM(user, messageOptions, guild, channel);
      }
    }
    // Silent fail for other errors
    return null;
  }
}

/**
 * Safely DM a user with context about where the message was meant to go
 * @param {Object} user - User to DM
 * @param {Object} messageOptions - Original message options
 * @param {Object} guild - Guild for context (optional)
 * @param {Object} channel - Channel for context (optional)
 * @returns {Promise<Message|null>} The sent DM or null if failed
 */
async function safeDM(user, messageOptions, guild = null, channel = null) {
  try {
    // Add context about where this was meant to be sent
    const contextNote = guild 
      ? `*I couldn't send this in ${channel ? `#${channel.name}` : 'the channel'} in **${guild.name}** due to missing permissions.*\n\n`
      : '';

    // Modify the message to include context
    const dmOptions = { ...messageOptions };
    
    if (dmOptions.content) {
      dmOptions.content = contextNote + dmOptions.content;
    } else if (dmOptions.embeds && dmOptions.embeds.length > 0) {
      // Add a note to the first embed's description or as content
      dmOptions.content = contextNote.trim();
    } else {
      dmOptions.content = contextNote.trim();
    }

    return await user.send(dmOptions);
  } catch (dmError) {
    // User has DMs disabled or blocked the bot
    return null;
  }
}

/**
 * Check if bot can send messages in a channel
 * @param {Object} channel - Discord channel
 * @returns {boolean} Whether bot can send messages
 */
function canSendInChannel(channel) {
  if (!channel.guild) return true; // DM channel
  const botMember = channel.guild.members?.me;
  if (!botMember) return false;
  return channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages) ?? false;
}

/**
 * Find a channel where the bot can send messages
 * @param {Object} guild - Discord guild
 * @returns {Object|null} A text channel where bot can send, or null
 */
function findSendableChannel(guild) {
  return guild.channels.cache.find(ch => 
    ch.isTextBased() && 
    ch.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)
  ) || null;
}
const { embeds } = require('../core/embeds');
const { getService } = require('@services');
const { findUser } = require('../handlers/finder');
const { checkBotAction } = require('./permissions');

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
 * Create a roleplay command function for prefix commands
 * @param {string} action - The action name (hug, kiss, pat, etc.)
 * @param {string} actionPastTense - The past tense of the action
 * @returns {Function} The command function
 */
function createRoleplayCommand(action, actionPastTense) {
  return async (client, message, args) => {
    try {
      const author = message.author;
      let targetUser;

      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found || !userResult.user) {
          const container = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`❌ <@${author.id}>: User not found!`)
            );
          return message.channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
          });
        }
        targetUser = userResult.user;
      } else {
        targetUser = author;
      }

      const targetId = targetUser.id || (targetUser.user && targetUser.user.id);
      const actualUser = targetUser.user || targetUser;
      targetUser = actualUser;

      if (!checkBotAction(message, targetUser)) return;

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

      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(description)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addMediaGalleryComponents(
          new MediaGalleryBuilder()
            .addItems(
              new MediaGalleryItemBuilder().setURL(gifUrl)
            )
        );

      if (reverseCount > 0 && targetUser.id !== author.id) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`-# ${targetUser.username} ${actionPastTense} ${author.username} ${reverseCount} times before`)
        );
      }

      return message.channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: ['users'] }
      });

    } catch (error) {
      console.log(`${action} command failed:`, error.message);

      const errorContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`❌ <@${message.author.id}>: Failed to ${action}! Please try again.`)
        );

      return message.channel.send({
        components: [errorContainer],
        flags: MessageFlags.IsComponentsV2
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
        return interaction.reply({ content: 'Leave me alone!', flags: MessageFlags.Ephemeral });
      }

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

      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(description)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addMediaGalleryComponents(
          new MediaGalleryBuilder()
            .addItems(
              new MediaGalleryItemBuilder().setURL(gifUrl)
            )
        );

      if (reverseCount > 0 && targetUser.id !== author.id) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`-# ${targetUser.username} ${actionPastTense} ${author.username} ${reverseCount} times before`)
        );
      }

      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: ['users'] }
      });

    } catch (error) {
      console.log(`${action} slash command failed:`, error.message);
      
      const errorContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`❌ <@${interaction.user.id}>: Failed to ${action}! Please try again.`)
        );

      return interaction.editReply({
        components: [errorContainer],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: ['users'] }
      });
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
    if (!data.link) throw new Error('API response missing link field');
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
          const container = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`❌ <@${message.author.id}>: User not found!`)
            );
          return message.channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
          });
        }
        targetUser = userResult.user;
      } else {
        targetUser = message.author;
      }

      const targetId = targetUser.id || (targetUser.user && targetUser.user.id);
      const actualUser = targetUser.user || targetUser;

      if (!checkBotAction(message, actualUser)) return;

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

      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(description)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addMediaGalleryComponents(
          new MediaGalleryBuilder()
            .addItems(
              new MediaGalleryItemBuilder().setURL(gifUrl)
            )
        );

      if (reverseCount > 0 && targetUserId !== message.author.id) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`-# ${targetUsername} ${actionPastTense} ${message.author.username} ${reverseCount} times before`)
        );
      }

      return message.channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: ['users'] }
      });

    } catch (error) {
      console.log(`${action} command failed:`, error.message);

      const errorContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`❌ <@${message.author.id}>: Failed to ${action}! Please try again.`)
        );

      return message.channel.send({
        components: [errorContainer],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: ['users'] }
      });
    }
  };
}

// ===== SPOTIFY HELPERS =====

/**
 * Check if user is linked and get access token
 * @param {Message|Interaction} context - Discord message or interaction
 * @returns {Promise<{isLinked: boolean, accessToken: string|null}>}
 */
async function checkSpotifyAccess(context) {
  const spotifyService = getService('spotify');
  // Support both message (prefix) and interaction (slash) commands
  const userId = context.user ? context.user.id : context.author.id;
  const isLinked = await spotifyService.isLinked(userId);

  if (!isLinked) {
    embeds.warn(context, 'You haven\'t linked your **Spotify** account. Use `,spotify login` to get started.');
    return { isLinked: false, accessToken: null };
  }

  const accessToken = await spotifyService.getAccessToken(userId);

  if (!accessToken) {
    embeds.warn(context, 'Failed to get **Spotify** access token. Please try linking your account again with `,spotify login`.');
    return { isLinked: true, accessToken: null };
  }

  return { isLinked: true, accessToken };
}

/**
 * Check for active Spotify devices
 * @param {Message|Interaction} context - Discord message or interaction
 * @param {string} accessToken - Spotify access token
 * @returns {Promise<Array|null>} Array of devices or null if none found
 */
async function checkActiveDevices(context, accessToken) {
  const spotifyService = getService('spotify');
  const devices = await spotifyService.getActiveDevices(accessToken);

  if (!devices || devices.length === 0) {
    embeds.warn(context, '**Player command failed**: No `active device` found!');
    return null;
  }

  return devices;
}

/**
 * Handle Spotify service errors with user-friendly messages
 * @param {Message|Interaction} context - Discord message or interaction
 * @param {Error} error - Error object
 */
function handleSpotifyError(context, error) {
  const errorCode = error.message || error.code;

  if (errorCode === 'NO_ACTIVE_DEVICE') {
    return embeds.warn(context, '**Player command failed**: No `active device` found!');
  }

  if (errorCode === 'PREMIUM_REQUIRED') {
    return embeds.warn(context, '**Premium** is required for **playback** feature.');
  }

  if (errorCode === 'TOKEN_EXPIRED') {
    return embeds.warn(context, 'Your **Spotify** session expired. Please run `,spotify login` again.');
  }

  if (errorCode === 'PLAYBACK_ERROR') {
    return embeds.warn(context, '**Player command failed**: No `active device` found!');
  }

  // Check if it's a FORBIDDEN error (user not in beta list)
  if (errorCode === 'FORBIDDEN' || errorCode.includes('403') || errorCode.includes('Forbidden') || errorCode.includes('unauthorized')) {
    const { EmbedBuilder } = require('discord.js');
    const config = require('../config/setup');
    // Support both message and interaction
    const user = context.user || context.author;

    const errorEmbed = new EmbedBuilder()
      .setColor(config.colors.error)
      .setDescription(
        `❌ ${user}: Your **Spotify account** is not approved for **adore** yet.\n\n` +
        `**Create a ticket** in the [\`support server\`](https://discord.gg/qsJMaTURqf) and provide your **Spotify email** to get added to the beta list.`
      );

    // Handle both message and interaction reply
    if (context.reply) {
      return context.reply({ embeds: [errorEmbed] });
    } else {
      return context.channel.send({ embeds: [errorEmbed] });
    }
  }

  return embeds.warn(context, error.message || 'An error occurred with **Spotify**.');
}

/**
 * Get the bot's avatar URL for a specific guild
 * Uses the server-specific avatar if set, otherwise falls back to global avatar
 * @param {Client} client - Discord client
 * @param {Guild} guild - Discord guild
 * @param {Object} options - Avatar URL options (size, format, dynamic)
 * @returns {string} The bot's avatar URL for the guild
 */
function getBotAvatarURL(client, guild, options = { dynamic: true, size: 256 }) {
  if (!guild) {
    return client.user.displayAvatarURL(options);
  }
  
  const botMember = guild.members.cache.get(client.user.id);
  if (botMember) {
    // displayAvatarURL returns guild avatar if set, otherwise global avatar
    return botMember.displayAvatarURL(options);
  }
  
  return client.user.displayAvatarURL(options);
}

module.exports = {
  // Shared
  getOrdinal,
  getBotAvatarURL,

  // Safe Send Utilities
  safeSend,
  safeDM,
  canSendInChannel,
  findSendableChannel,

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
