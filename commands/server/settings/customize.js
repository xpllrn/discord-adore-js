const { PermissionFlagsBits, Routes } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const axios = require('axios');
const logger = require('../../../utils/logger');

// Per-subcommand cooldown tracking
const subcommandCooldowns = new Map();

// Cooldown durations for each subcommand (in milliseconds)
const COOLDOWN_DURATIONS = {
  avatar: 300000, // 5 minutes
  banner: 300000, // 5 minutes
  bio: 300000     // 5 minutes
};

/**
 * Check and apply cooldown for a specific subcommand
 * @param {string} userId - User ID
 * @param {string} subcommand - Subcommand name
 * @returns {Object|null} - Returns {timeLeft, timeString} if on cooldown, null otherwise
 */
function checkSubcommandCooldown(userId, subcommand) {
  const cooldownKey = `${userId}-${subcommand}`;
  const now = Date.now();
  const cooldownAmount = COOLDOWN_DURATIONS[subcommand] || 300000;

  if (subcommandCooldowns.has(cooldownKey)) {
    const expirationTime = subcommandCooldowns.get(cooldownKey) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      const timeString = timeLeft >= 60
        ? `${Math.floor(timeLeft / 60)}m ${Math.floor(timeLeft % 60)}s`
        : `${timeLeft.toFixed(1)}s`;
      return { timeLeft, timeString };
    }
  }

  // Set cooldown
  subcommandCooldowns.set(cooldownKey, now);
  setTimeout(() => subcommandCooldowns.delete(cooldownKey), cooldownAmount);

  return null;
}

module.exports = {
  name: "customize",
  aliases: ['custom'],
  description: 'Customize the bot\'s server profile (avatar, banner, bio)',
  permission: "Server Owner",
  isGroupCommand: true,

  run: async (client, message, args) => {

    // Check if user is server owner
    if (message.guild.ownerId !== message.author.id) {
      return embeds.deny(message, 'Only the **server owner** can use this command');
    }

    // Check if bot has permission to edit its own profile
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ChangeNickname)) {
      return embeds.deny(message, 'I need **Change Nickname** permission to customize my server profile');
    }

    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || !['avatar', 'banner', 'bio'].includes(subcommand)) {
      return false;
    }

    // Check subcommand-specific cooldown
    const cooldownCheck = checkSubcommandCooldown(message.author.id, subcommand);
    if (cooldownCheck) {
      return embeds.cooldown(message, `Please wait **${cooldownCheck.timeString}** before using \`customize ${subcommand}\` again.`);
    }

    // Handle avatar customization
    if (subcommand === 'avatar') {
      const subcommandInfo = {
        description: 'Customize the bot\'s server avatar',
        usage: '{guildprefix}customize avatar [image url/attachment]',
        aliases: [],
        parameters: ['image (optional)'],
        example: '{guildprefix}customize avatar https://example.com/image.png'
      };

      // Get image URL from attachment or argument
      let imageUrl = args[1];

      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (attachment.contentType && attachment.contentType.startsWith('image/')) {
          imageUrl = attachment.url;
        } else {
          return embeds.warn(message, 'Please provide a valid image attachment');
        }
      }

      // If no image URL or attachment, reset to global
      if (!imageUrl) {
        try {
          console.log('[CUSTOMIZE] Resetting server avatar to global');

          await client.rest.patch(
            Routes.guildMember(message.guild.id, '@me'),
            {
              body: {
                avatar: null
              }
            }
          );

          return embeds.success(message, 'Reset my **server avatar** to the global avatar');
        } catch (error) {
          logger.webhook.error(error, message);
          logger.webhook.error(error, message);
          return embeds.deny(message, `Failed to reset avatar: ${error.message}`);
        }
      }

      // Validate URL format
      if (!imageUrl.match(/^https?:\/\/.+/)) {
        return embeds.warn(message, 'Please provide a valid image URL');
      }

      try {
        console.log('[CUSTOMIZE] Downloading avatar image from:', imageUrl);

        // Download the image
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        // Check if it's an image
        const contentType = response.headers['content-type'];
        if (!contentType || !contentType.startsWith('image/')) {
          console.log('[CUSTOMIZE] Invalid content type:', contentType);
          return embeds.warn(message, 'The provided URL does not point to a valid image');
        }

        // Convert to base64 data URI
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        const dataUri = `data:${contentType};base64,${base64Image}`;

        console.log('[CUSTOMIZE] Attempting to set server avatar via REST API');
        console.log('[CUSTOMIZE] Guild ID:', message.guild.id);
        console.log('[CUSTOMIZE] Using @me endpoint');

        // Use REST API to set server-specific avatar
        const result = await client.rest.patch(
          Routes.guildMember(message.guild.id, '@me'),
          {
            body: {
              avatar: dataUri
            }
          }
        );

        console.log('[CUSTOMIZE] API Response:', JSON.stringify(result, null, 2));

        return embeds.success(message, 'Updated my **server avatar** successfully');

      } catch (error) {
        logger.webhook.error(error, message);
        logger.webhook.error(error, message);
        logger.webhook.error(error, message);
        logger.webhook.error(error, message);

        if (error.code === 50035) {
          return embeds.deny(message, 'Invalid image format. Please use PNG, JPG, or GIF');
        }

        if (error.code === 50013) {
          return embeds.deny(message, 'Missing permissions to edit server profile');
        }

        if (error.code === 'ERR_BAD_REQUEST' || (error.response && error.response.status === 404) || error.status === 404) {
          return embeds.deny(message, 'Could not download the image. The URL may be invalid or the content has been deleted.');
        }

        return embeds.deny(message, `Failed to set avatar: ${error.message || 'Unknown error'}`);
      }
    }

    // Handle banner customization
    if (subcommand === 'banner') {
      const subcommandInfo = {
        description: 'Customize the bot\'s server banner',
        usage: '{guildprefix}customize banner [image url/attachment]',
        aliases: [],
        parameters: ['image (optional)'],
        example: '{guildprefix}customize banner https://example.com/banner.png'
      };

      // Get image URL from attachment or argument
      let imageUrl = args[1];

      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (attachment.contentType && attachment.contentType.startsWith('image/')) {
          imageUrl = attachment.url;
        } else {
          return embeds.warn(message, 'Please provide a valid image attachment');
        }
      }

      // If no image URL or attachment, reset to global
      if (!imageUrl) {
        try {
          console.log('[CUSTOMIZE] Resetting server banner to global');

          await client.rest.patch(
            Routes.guildMember(message.guild.id, '@me'),
            {
              body: {
                banner: null
              }
            }
          );

          return embeds.success(message, 'Reset my **server banner** to the global banner');
        } catch (error) {
          logger.webhook.error(error, message);
          logger.webhook.error(error, message);
          return embeds.deny(message, `Failed to reset banner: ${error.message}`);
        }
      }

      // Validate URL format
      if (!imageUrl.match(/^https?:\/\/.+/)) {
        return embeds.warn(message, 'Please provide a valid image URL');
      }

      try {
        console.log('[CUSTOMIZE] Downloading banner image from:', imageUrl);

        // Download the image
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        // Check if it's an image
        const contentType = response.headers['content-type'];
        if (!contentType || !contentType.startsWith('image/')) {
          console.log('[CUSTOMIZE] Invalid content type:', contentType);
          return embeds.warn(message, 'The provided URL does not point to a valid image');
        }

        // Convert to base64 data URI
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        const dataUri = `data:${contentType};base64,${base64Image}`;

        console.log('[CUSTOMIZE] Attempting to set server banner via REST API');
        console.log('[CUSTOMIZE] Guild ID:', message.guild.id);
        console.log('[CUSTOMIZE] Using @me endpoint');

        // Use REST API to set server-specific banner
        const result = await client.rest.patch(
          Routes.guildMember(message.guild.id, '@me'),
          {
            body: {
              banner: dataUri
            }
          }
        );

        console.log('[CUSTOMIZE] API Response:', JSON.stringify(result, null, 2));

        return embeds.success(message, 'Updated my **server banner** successfully');

      } catch (error) {
        logger.webhook.error(error, message);
        logger.webhook.error(error, message);
        logger.webhook.error(error, message);
        logger.webhook.error(error, message);

        if (error.code === 50035) {
          return embeds.deny(message, 'Invalid image format. Please use PNG, JPG, or GIF');
        }

        if (error.code === 50013) {
          return embeds.deny(message, 'Missing permissions to edit server profile');
        }

        if (error.code === 'ERR_BAD_REQUEST' || (error.response && error.response.status === 404) || error.status === 404) {
          return embeds.deny(message, 'Could not download the image. The URL may be invalid or the content has been deleted.');
        }

        return embeds.deny(message, `Failed to set banner: ${error.message || 'Unknown error'}`);
      }
    }

    // Handle bio customization
    if (subcommand === 'bio') {
      const subcommandInfo = {
        description: 'Customize the bot\'s server bio',
        usage: '{guildprefix}customize bio [text]',
        aliases: [],
        parameters: ['text (optional)'],
        example: '{guildprefix}customize bio Best bot ever!'
      };

      // Get bio text
      const bioText = args.slice(1).join(' ');

      // If no bio text, reset to global
      if (!bioText) {
        try {
          console.log('[CUSTOMIZE] Resetting server bio to global');

          await client.rest.patch(
            Routes.guildMember(message.guild.id, '@me'),
            {
              body: {
                bio: null
              }
            }
          );

          return embeds.success(message, 'Reset my **server bio** to the global bio');
        } catch (error) {
          logger.webhook.error(error, message);
          logger.webhook.error(error, message);
          return embeds.deny(message, `Failed to reset bio: ${error.message}`);
        }
      }

      // Discord bio has a 190 character limit
      if (bioText.length > 190) {
        return embeds.warn(message, `Bio text is too long (${bioText.length}/190 characters). Please shorten it.`);
      }

      try {
        console.log('[CUSTOMIZE] Attempting to set server bio via REST API');
        console.log('[CUSTOMIZE] Guild ID:', message.guild.id);
        console.log('[CUSTOMIZE] Using @me endpoint');
        console.log('[CUSTOMIZE] Bio text:', bioText);

        // Use REST API to set server-specific bio
        const result = await client.rest.patch(
          Routes.guildMember(message.guild.id, '@me'),
          {
            body: {
              bio: bioText
            }
          }
        );

        console.log('[CUSTOMIZE] API Response:', JSON.stringify(result, null, 2));

        return embeds.success(message, `Updated my **server bio** to:\n\`\`\`${bioText}\`\`\``);

      } catch (error) {
        logger.webhook.error(error, message);
        logger.webhook.error(error, message);
        logger.webhook.error(error, message);
        logger.webhook.error(error, message);

        if (error.code === 50035) {
          return embeds.deny(message, 'Invalid bio text. Please check for special characters or length');
        }

        if (error.code === 50013) {
          return embeds.deny(message, 'Missing permissions to edit server profile');
        }

        return embeds.deny(message, `Failed to set bio: ${error.message || 'Unknown error'}`);
      }
    }
  }
};
