const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, PermissionFlagsBits } = require('../../../utils/permissions');

module.exports = {
  name: "setsplash",
  aliases: ['setsplashbackground'],
  description: 'set the server invite splash screen (requires boost level 1+)',
  syntax: 'setsplash (image)',
  example: 'setsplash [attach image]',
  permission: "manage_guild",
  run: async (client, message, args) => {

    // Check user permissions
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) {
      return;
    }

    // Check bot permissions
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return embeds.deny(message, 'I need **Manage Guild** permission to use this command');
    }

    // Check if server has splash feature (boost level 1+)
    if (message.guild.premiumTier < 1) {
      return embeds.warn(message, 'This server needs **boost level 1** or higher to have a custom invite splash screen.');
    }

    try {
      let splashURL = null;

      // Check for attachment
      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();

        // Validate file type
        const validTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'];
        if (!validTypes.includes(attachment.contentType)) {
          return embeds.warn(message, 'Invalid file type. Please use PNG, JPG, JPEG, GIF, or WEBP format.');
        }

        // Check file size (Discord limit is 8MB for server splash)
        if (attachment.size > 8 * 1024 * 1024) {
          return embeds.warn(message, 'File size too large. Maximum size is 8MB.');
        }

        splashURL = attachment.url;

      } else if (args[0]) {
        // Check for URL
        const urlRegex = /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i;
        if (!urlRegex.test(args[0])) {
          return embeds.warn(message, 'Invalid URL. Please provide a direct link to a PNG, JPG, JPEG, GIF, or WEBP image.');
        }
        splashURL = args[0];

      } else {
        // No attachment or URL provided - remove splash
        await message.guild.setSplash(null, `Splash removed by ${message.author.tag}`);
        return embeds.success(message, `Successfully **removed** the server invite splash screen`);
      }

      // Set the new splash
      const statusMessage = await embeds.warn(message, 'Setting server invite splash screen...');

      await message.guild.setSplash(splashURL, `Splash changed by ${message.author.tag}`);

      // Edit the status message to show success
      setTimeout(async () => {
        try {
          await statusMessage.edit({
            embeds: [embeds.createSuccess(message, 'Successfully **updated** the server invite splash screen')]
          });
        } catch (editError) {
          // Message might have been deleted
        }
      }, 2000);

    } catch (error) {
      if (error.code === 50035) {
        return embeds.warn(message, 'Invalid image format or corrupted file.');
      } else if (error.code === 50013) {
        return embeds.warn(message, 'Missing permissions to change server splash.');
      } else {
        return embeds.warn(message, 'An error occurred while setting the server invite splash screen.');
      }
    }
  }
}
