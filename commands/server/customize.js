const { PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const axios = require('axios');

module.exports = {
  name: "customize",
  aliases: ['custom'],
  description: 'Customize the bot\'s server profile (avatar, banner, bio)',
  usage: `{guildprefix}customize avatar [image url/attachment]
{guildprefix}customize avatar reset
{guildprefix}customize banner [image url/attachment]
{guildprefix}customize banner reset
{guildprefix}customize bio [bio text]
{guildprefix}customize bio reset`,
  permission: "Server Owner",

  run: async(client, message, args) => {
    
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

    // Handle avatar customization
    if (subcommand === 'avatar') {
      // Reset avatar to global
      if (args[1] && args[1].toLowerCase() === 'reset') {
        try {
          await message.guild.members.me.edit({
            avatar: null
          });
          
          return embeds.success(message, 'Reset my **server avatar** to the global avatar');
        } catch (error) {
          console.error('Bot avatar reset error:', error);
          return embeds.deny(message, `Failed to reset avatar: ${error.message}`);
        }
      }

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

      if (!imageUrl) {
        return embeds.warn(message, 'Please provide an image URL or attach an image');
      }

      // Validate URL format
      if (!imageUrl.match(/^https?:\/\/.+/)) {
        return embeds.warn(message, 'Please provide a valid image URL');
      }

      try {
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
          return embeds.warn(message, 'The provided URL does not point to a valid image');
        }

        // Convert to base64 data URI
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        const dataUri = `data:${contentType};base64,${base64Image}`;

        // Set the server-specific avatar
        await message.guild.members.me.edit({
          avatar: dataUri
        });

        return embeds.success(message, 'Updated my **server avatar** successfully');
        
      } catch (error) {
        console.error('Bot avatar error:', error);
        
        if (error.code === 50035) {
          return embeds.deny(message, 'Invalid image format. Please use PNG, JPG, or GIF');
        }
        
        if (error.response && error.response.status === 404) {
          return embeds.deny(message, 'Could not download the image from the provided URL');
        }
        
        return embeds.deny(message, `Failed to set avatar: ${error.message}`);
      }
    }

    // Handle banner customization
    if (subcommand === 'banner') {
      // Reset banner to global
      if (args[1] && args[1].toLowerCase() === 'reset') {
        try {
          await message.guild.members.me.edit({
            banner: null
          });
          
          return embeds.success(message, 'Reset my **server banner** to the global banner');
        } catch (error) {
          console.error('Bot banner reset error:', error);
          return embeds.deny(message, `Failed to reset banner: ${error.message}`);
        }
      }

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

      if (!imageUrl) {
        return embeds.warn(message, 'Please provide an image URL or attach an image');
      }

      // Validate URL format
      if (!imageUrl.match(/^https?:\/\/.+/)) {
        return embeds.warn(message, 'Please provide a valid image URL');
      }

      try {
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
          return embeds.warn(message, 'The provided URL does not point to a valid image');
        }

        // Convert to base64 data URI
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        const dataUri = `data:${contentType};base64,${base64Image}`;

        // Set the server-specific banner
        await message.guild.members.me.edit({
          banner: dataUri
        });

        return embeds.success(message, 'Updated my **server banner** successfully');
        
      } catch (error) {
        console.error('Bot banner error:', error);
        
        if (error.code === 50035) {
          return embeds.deny(message, 'Invalid image format. Please use PNG, JPG, or GIF');
        }
        
        if (error.response && error.response.status === 404) {
          return embeds.deny(message, 'Could not download the image from the provided URL');
        }
        
        return embeds.deny(message, `Failed to set banner: ${error.message}`);
      }
    }

    // Handle bio customization
    if (subcommand === 'bio') {
      // Reset bio to global
      if (args[1] && args[1].toLowerCase() === 'reset') {
        try {
          await message.guild.members.me.edit({
            bio: null
          });
          
          return embeds.success(message, 'Reset my **server bio** to the global bio');
        } catch (error) {
          console.error('Bot bio reset error:', error);
          return embeds.deny(message, `Failed to reset bio: ${error.message}`);
        }
      }

      // Get bio text
      const bioText = args.slice(1).join(' ');
      
      if (!bioText) {
        return embeds.warn(message, 'Please provide a bio text or use `reset` to clear it');
      }

      // Discord bio has a 190 character limit
      if (bioText.length > 190) {
        return embeds.warn(message, `Bio text is too long (${bioText.length}/190 characters). Please shorten it.`);
      }

      try {
        // Set the server-specific bio
        await message.guild.members.me.edit({
          bio: bioText
        });

        return embeds.success(message, `Updated my **server bio** to:\n\`\`\`${bioText}\`\`\``);
        
      } catch (error) {
        console.error('Bot bio error:', error);
        
        if (error.code === 50035) {
          return embeds.deny(message, 'Invalid bio text. Please check for special characters or length');
        }
        
        return embeds.deny(message, `Failed to set bio: ${error.message}`);
      }
    }
  }
};
