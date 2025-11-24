const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, PermissionFlagsBits } = require('../../../utils/permissions');

module.exports = {
  name: "seticon",
  aliases: ['setavatar'],
  description: 'set the server icon',
  syntax: 'seticon (image)',
  example: 'seticon [attach image]',
  permission: "manage_guild",
  run: async(client, message, args) => {

    // Check user permissions
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) {
      return;
    }

    // Check bot permissions
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return embeds.deny(message, 'I need **Manage Guild** permission to use this command');
    }

    try {
      let iconURL = null;

      // Check for attachment
      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        
        // Validate file type
        const validTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'];
        if (!validTypes.includes(attachment.contentType)) {
          return embeds.warn(message, 'Invalid file type. Please use PNG, JPG, JPEG, GIF, or WEBP format.');
        }

        // Check file size (Discord limit is 8MB for server icons)
        if (attachment.size > 8 * 1024 * 1024) {
          return embeds.warn(message, 'File size too large. Maximum size is 8MB.');
        }

        iconURL = attachment.url;

      } else if (args[0]) {
        // Check for URL
        const urlRegex = /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i;
        if (!urlRegex.test(args[0])) {
          return embeds.warn(message, 'Invalid URL. Please provide a direct link to a PNG, JPG, JPEG, GIF, or WEBP image.');
        }
        iconURL = args[0];

      } else {
        // No attachment or URL provided - remove icon
        await message.guild.setIcon(null, `Icon removed by ${message.author.tag}`);
        return embeds.success(message, `Successfully **removed** the server icon`);
      }

      // Set the new icon
      const statusMessage = await embeds.warn(message, 'Setting server icon...');

      await message.guild.setIcon(iconURL, `Icon changed by ${message.author.tag}`);

      // Edit the status message to show success
      setTimeout(async () => {
        try {
          await statusMessage.edit({ 
            embeds: [embeds.createSuccess(message, 'Successfully **updated** the server icon')] 
          });
        } catch (editError) {
          // Message might have been deleted
        }
      }, 2000);

    } catch (error) {
      if (error.code === 50035) {
        return embeds.warn(message, 'Invalid image format or corrupted file.');
      } else if (error.code === 50013) {
        return embeds.warn(message, 'Missing permissions to change server icon.');
      } else {
        return embeds.warn(message, 'An error occurred while setting the server icon.');
      }
    }
  }
}
