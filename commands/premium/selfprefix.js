const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const logger = require('../../utils/logger');

module.exports = {
  name: "selfprefix",
  aliases: ['sp'],
  description: `Manage your personal prefix`,
  syntax: 'selfprefix (set/remove) (prefix)',
  example: 'selfprefix set !',


  run: async (_, message, args) => {
    const subcommand = args[0]?.toLowerCase();
    const newPrefix = args[1];

    if (!subcommand) {
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
    if (subcommand === 'set') {
      return handleSetSelfPrefix(message, newPrefix);
    } else if (subcommand === 'remove' || subcommand === 'clear') {
      return handleRemoveSelfPrefix(message);
    } else {
      const { processCommand } = require('../../utils/commandProcessor');
      return processCommand({
        ...message,
        content: `,h selfprefix`
      });
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
