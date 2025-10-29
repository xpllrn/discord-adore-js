const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { hasDiscordPermission, PermissionFlagsBits } = require('../../utils/permissions');

module.exports = {
  name: "prefix",
  aliases: ['setprefix'],
  description: `Manage server prefix`,
  permission: 'Administrator',
  isGroupCommand: true,

  run: async (_, message, args) => {
    const subcommand = args[0]?.toLowerCase();
    const newPrefix = args[1];

    if (!subcommand) {
      const subcommandInfo = {
        description: 'Shows the current server prefix',
        usage: '{guildprefix}prefix',
        aliases: [],
        parameters: [],
        example: '{guildprefix}prefix'
      };

      try {
        const prefixService = getService('prefix');
        const guildPrefix = await prefixService.getGuildPrefix(message.guild.id);
        const description = `Your Server **prefix:** \`${guildPrefix}\``;
        return embeds.info(message, description);
      } catch (error) {
        return embeds.warn(message, 'Failed to retrieve server prefix. Please try again.');
      }
    }

    // Handle subcommands
    if (subcommand === 'set') {
      const subcommandInfo = {
        description: 'Sets a new prefix for the server',
        usage: '{guildprefix}prefix set [prefix]',
        aliases: [],
        parameters: ['prefix'],
        example: '{guildprefix}prefix set $'
      };

      return handleSetGuildPrefix(message, newPrefix);
    } else if (subcommand === 'remove') {
      const subcommandInfo = {
        description: 'Removes the custom prefix and resets to default',
        usage: '{guildprefix}prefix remove',
        aliases: ['reset', 'default'],
        parameters: [],
        example: '{guildprefix}prefix remove'
      };

      return handleRemoveGuildPrefix(message);
    } else {
      const { processCommand } = require('../../utils/commandProcessor');
      return processCommand({
        ...message,
        content: `,h prefix`
      });
    }
  }
};

async function handleSetGuildPrefix(message, newPrefix) {
  // Check if user has Administrator permission
  if (!hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator')) {
    return;
  }

  if (!newPrefix) {
    return embeds.warn(message, "Please provide a prefix to set!");
  }

  if (newPrefix.toLowerCase() === 'none') {
    return embeds.warn(message, "Server prefix cannot be removed!");
  }

  if (newPrefix.length > 3) {
    return embeds.warn(message, "Prefix **can't** be over 3 characters.");
  }

  if (newPrefix.includes(' ')) {
    return embeds.warn(message, "Prefix **can't** contain spaces.");
  }

  try {
    const prefixService = getService('prefix');
    const success = await prefixService.setGuildPrefix(message.guild.id, newPrefix);

    if (success) {
      return embeds.success(message, `Server prefix has been **changed** to \`${newPrefix}\``);
    } else {
      return embeds.warn(message, "Failed to update server prefix. Please try again.");
    }
  } catch (error) {
    return embeds.warn(message, "An error occurred while updating the prefix. Please try again.");
  }
}

async function handleRemoveGuildPrefix(message) {
  // Check if user has Administrator permission
  if (!hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator')) {
    return;
  }

  try {
    const config = require('../../config/setup');
    const prefixService = getService('prefix');
    const defaultPrefix = config.bot.defaultPrefix;
    
    const success = await prefixService.setGuildPrefix(message.guild.id, defaultPrefix);

    if (success) {
      return embeds.success(message, `Server prefix has been **reset** to default \`${defaultPrefix}\``);
    } else {
      return embeds.warn(message, "Failed to reset server prefix. Please try again.");
    }
  } catch (error) {
    return embeds.warn(message, "An error occurred while resetting the prefix. Please try again.");
  }
}
