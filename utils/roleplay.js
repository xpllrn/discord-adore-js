const fetch = require('node-fetch');
const { EmbedBuilder } = require('discord.js');
const { colors } = require('../config/setup');
const userCache = require('../database/cache/models/user');
const { findUser } = require('../handlers/finder');
const { checkBotAction } = require('./permissions');

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

/**
 * Fetch a GIF from multiple APIs with fallback support
 * @param {string} action - The action type (hug, kiss, pat, etc.)
 * @returns {Promise<string>} The GIF URL
 */
async function fetchWaifuGif(action) {
  // Map of actions to their API endpoints (some actions might use different endpoints)
  const actionMap = {
    'bonk': 'bonk',
    'bully': 'bully',
    'bite': 'bite',
    'glomp': 'glomp',
    'slap': 'slap',
    'kill': 'kill',
    'poke': 'poke',
    'punch': 'punch',
    'yeet': 'yeet',
    'angry': 'angry',
    'lick': 'lick',
    'hug': 'hug',
    'cuddle': 'cuddle',
    'kiss': 'kiss',
    'pat': 'pat',
    'headpat': 'pat', // Use pat endpoint for headpat
    'tickle': 'tickle',
    'nom': 'nom',
    'smug': 'smug',
    'blush': 'blush',
    'cry': 'cry',
    'wave': 'wave',
    'highfive': 'highfive',
    'dance': 'dance',
    'stare': 'stare',
    'facepalm': 'facepalm',
    'sleep': 'sleep',
    'run': 'run',
    'laugh': 'laugh',
    'wink': 'wink'
  };

  const endpoint = actionMap[action] || action;

  // Multiple API endpoints for fallback
  const apiEndpoints = [
    `https://api.waifu.pics/sfw/${endpoint}`,
    `https://nekos.life/api/v2/img/${endpoint}`,
    `https://waifu.it/api/v4/${endpoint}`
  ];

  // Try each API endpoint until one works
  for (let i = 0; i < apiEndpoints.length; i++) {
    try {
      const response = await fetch(apiEndpoints[i]);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      // Different APIs have different response formats
      if (i === 0) {
        // Waifu.pics format
        return data.url;
      } else if (i === 1) {
        // Nekos.life format
        return data.url;
      } else if (i === 2) {
        // Waifu.it format
        return data.url;
      }

    } catch (error) {
      // Log API failures as debug info instead of errors since these are external API issues
      console.log(`API ${i + 1} (${apiEndpoints[i]}) failed for ${action}:`, error.message);

      // If this is the last API and it failed, throw error
      if (i === apiEndpoints.length - 1) {
        throw new Error(`Failed to fetch ${action} GIF from all APIs`);
      }
      // Otherwise, continue to next API
    }
  }
}

/**
 * Create a roleplay command function
 * @param {string} action - The action name (hug, kiss, pat, etc.)
 * @param {string} actionPastTense - The past tense of the action (hugged, kissed, patted, etc.)
 * @returns {Function} The command function
 */
function createRoleplayCommand(action, actionPastTense) {
  return async (client, message, args) => {
    try {
      // Check if user mentioned someone
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
        // No target specified - use themselves
        targetUser = message.author;
      }

      // Get the actual user ID and user object
      const targetId = targetUser.id || (targetUser.user && targetUser.user.id);
      const actualUser = targetUser.user || targetUser;

      // Check if trying to target our bot specifically
      if (actualUser.id === message.guild.members.me.id) {
        return message.channel.send('Leave me alone!');
      }

      // Fetch GIF from Waifu.pics
      const gifUrl = await fetchWaifuGif(action);

      // Get the actual user ID and username (handle both User and GuildMember objects)
      const targetUserId = targetId;
      const targetUsername = actualUser.username || 'Unknown';

      // Track the interaction and get count
      const count = await userCache.trackRoleplayInteraction(
        message.author.id,
        targetUserId,
        action
      );

      // Get how many times the target has performed this action on the user (for footer)
      const reverseCount = await userCache.getRoleplayCount(targetUserId, message.author.id, action);

      // Create description based on whether it's self-action or targeting someone else
      let description;
      if (targetUserId === message.author.id) {
        // Self-action - no counting, just simple message
        description = `<@${message.author.id}> ${actionPastTense} themselves`;
      } else {
        // Targeting someone else - show count
        description = `<@${message.author.id}> ${actionPastTense} <@${targetUserId}> for the ${getOrdinal(count)} time!`;
      }

      // Create footer text - only show if reverseCount > 0 and not self-action
      // Show how many times the target has performed this action on the user
      let footerText = '';
      if (reverseCount > 0 && targetUserId !== message.author.id) {
        footerText = `${targetUsername} ${actionPastTense} ${message.author.username} ${reverseCount} times before`;
      }

      // Create and send embed
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

module.exports = {
  getOrdinal,
  fetchWaifuGif,
  createRoleplayCommand
};
