const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const logger = require('../../utils/logger');

module.exports = {
  name: "selfprefix",
  aliases: ['selfp'],
  description: `Manage your personal prefix`,
  isGroupCommand: true,

  run: async (_, message, args) => {
    if (!args[0]) {
      const subcommandInfo = {
        description: 'Shows your current personal prefix',
        usage: '{guildprefix}selfprefix',
        aliases: [],
        parameters: [],
        example: '{guildprefix}selfprefix'
      };

      try {
        const prefixService = getService('prefix');
        const userPrefix = await prefixService.getUserPrefix(message.author.id);

        const description = userPrefix 
          ? `**Your self prefix:** \`${userPrefix}\``
          : `**Your self prefix:** *Not set*`;

        return embeds.info(message, description);
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.warn(message, 'Failed to retrieve your self prefix. Please try again.');
      }
    }

    // Handle subcommands
    if (args[0] === 'set') {
      const subcommandInfo = {
        description: 'Set your personal prefix',
        usage: '{guildprefix}selfprefix set [prefix]',
        aliases: [],
        parameters: ['prefix'],
        example: '{guildprefix}selfprefix set !'
      };

      return handleSetSelfPrefix(message, args[1]);
      
    } else if (args[0] === 'remove' || args[0] === 'clear') {
      const subcommandInfo = {
        description: 'Remove your personal prefix',
        usage: '{guildprefix}selfprefix remove',
        aliases: ['clear'],
        parameters: [],
        example: '{guildprefix}selfprefix remove'
      };

      return handleRemoveSelfPrefix(message);
      
    } else {
      return false;
    }
  }
};

async function handleSetSelfPrefix(message, newPrefix) {
  if (!newPrefix) {
    return embeds.warn(message, "Please provide a prefix to set!");
  }

  if (newPrefix.length > 3) {
    return embeds.warn(message, "Prefix **can't** be over 3 characters.");
  }

  if (newPrefix.includes(' ')) {
    return embeds.warn(message, "Prefix **can't** contain spaces.");
  }

  try {
    const prefixService = getService('prefix');
    const success = await prefixService.setUserPrefix(message.author.id, newPrefix);
    if (success) {
      return embeds.success(message, `Your self prefix has been **set** to \`${newPrefix}\``);
    } else {
      return embeds.warn(message, "Failed to set self prefix. Please try again.");
    }
  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, "An error occurred while setting your prefix. Please try again.");
  }
}

async function handleRemoveSelfPrefix(message) {
  try {
    const prefixService = getService('prefix');
    const success = await prefixService.clearUserPrefix(message.author.id);
    if (success) {
      return embeds.success(message, "Your self prefix has been **removed**!");
    } else {
      return embeds.warn(message, "Failed to remove self prefix. Please try again.");
    }
  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.warn(message, "An error occurred while removing your prefix. Please try again.");
  }
}
