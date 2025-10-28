const fetch = require('node-fetch');
const { EmbedBuilder } = require('discord.js');
const { colors } = require('../config/setup');
const { embeds } = require('../core/embeds');
const { getService } = require('@services');
const { findUser } = require('../handlers/finder');

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
 * Fetch a NSFW GIF from Purrbot API
 * @param {string} action - The action type (anal, blowjob, cum, etc.)
 * @returns {Promise<string>} The GIF URL
 */
async function fetchNSFWGif(action) {
  try {
    const response = await fetch(`https://api.purrbot.site/v2/img/nsfw/${action}/gif`);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.message || 'API returned an error');
    }

    return data.link;
  } catch (error) {
    console.log(`Purrbot API failed for ${action}:`, error.message);
    throw new Error(`Failed to fetch ${action} GIF from Purrbot API`);
  }
}

/**
 * Check if channel is NSFW
 * @param {Object} channel - Discord channel object
 * @returns {boolean} Whether the channel is NSFW
 */
function isNSFWChannel(channel) {
  return channel.nsfw === true;
}

/**
 * Create a NSFW roleplay command function
 * @param {string} action - The action name (anal, blowjob, cum, etc.)
 * @param {string} actionPastTense - The past tense of the action
 * @returns {Function} The command function
 */
function createNSFWRoleplayCommand(action, actionPastTense) {
  return async (client, message, args) => {
    try {
      // Check if channel is NSFW
      if (!isNSFWChannel(message.channel)) {
        return embeds.deny(message, 'This command can only be used in NSFW channels! 🔞');
      }

      // Check if user mentioned someone
      let targetUser;
      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found || !userResult.user) {
          return embeds.deny(message, userResult.error || 'User not found!');
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

      // Fetch GIF from Purrbot API
      const gifUrl = await fetchNSFWGif(action);

      // Get the actual user ID and username (handle both User and GuildMember objects)
      const targetUserId = targetId;
      const targetUsername = actualUser.username || 'Unknown';
      const userService = getService('user');

      // Track the interaction and get count
      const count = await userService.trackRoleplayInteraction(
        message.author.id,
        targetUserId,
        action
      );

      // Get how many times the target has performed this action on the user (for footer)
      const reverseCount = await userService.getRoleplayCount(targetUserId, message.author.id, action);

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
      return embeds.warn(message, `Failed to ${action}! Please try again.`);
    }
  };
}

module.exports = {
  getOrdinal,
  fetchNSFWGif,
  createNSFWRoleplayCommand,
  isNSFWChannel
};