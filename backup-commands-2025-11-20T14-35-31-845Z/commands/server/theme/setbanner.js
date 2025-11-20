const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, PermissionFlagsBits } = require('../../../utils/permissions');

module.exports = {
  name: "setbanner",
  aliases: [],
  description: 'set the server banner (requires boost level 2+)',
  syntax: 'setbanner (image)',
  example: 'setbanner [attach image]',
  permission: "Manage Guild",
  run: async(client, message, args) => {

    // Check user permissions
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) {
      return;
    }

    // Check bot permissions
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return embeds.deny(message, 'I need **Manage Guild** permission to use this command');
    }

    // Check if server has banner feature (boost level 2+)
    if (message.guild.premiumTier < 2) {
      return embeds.warn(message, 'This server needs **boost level 2** or higher to have a custom banner.');
    }

    try {
      let bannerURL = null;

      // Check for attachment
      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        
        // Validate file type
        const validTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'];
        if (!validTypes.includes(attachment.contentType)) {
          return embeds.warn(message, 'Invalid file type. Please use PNG, JPG, JPEG, GIF, or WEBP format.');
        }

        // Check file size (Discord limit is 8MB for server banners)
        if (attachment.size > 8 * 1024 * 1024) {
          return embeds.warn(message, 'File size too large. Maximum size is 8MB.');
        }

        bannerURL = attachment.url;

      } else if (args[0]) {
        // Check for URL
        const urlRegex = /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i;
        if (!urlRegex.test(args[0])) {
          return embeds.warn(message, 'Invalid URL. Please provide a direct link to a PNG, JPG, JPEG, GIF, or WEBP image.');
        }
        bannerURL = args[0];

      } else {
        // No attachment or URL provided - remove banner
        await message.guild.setBanner(null, `Banner removed by ${message.author.tag}`);
        return embeds.success(message, `Successfully **removed** the server banner`);
      }

      // Set the new banner
      const statusMessage = await embeds.warn(message, 'Setting server banner...');

      await message.guild.setBanner(bannerURL, `Banner changed by ${message.author.tag}`);

      // Edit the status message to show success
      setTimeout(async () => {
        try {
          await statusMessage.edit({ 
            embeds: [embeds.createSuccess(message, 'Successfully **updated** the server banner')] 
          });
        } catch (editError) {
          // Message might have been deleted
        }
      }, 2000);

    } catch (error) {
      if (error.code === 50035) {
        return embeds.warn(message, 'Invalid image format or corrupted file.');
      } else if (error.code === 50013) {
        return embeds.warn(message, 'Missing permissions to change server banner.');
      } else {
        return embeds.warn(message, 'An error occurred while setting the server banner.');
      }
    }
  }
}
