const { SlashCommandBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const logger = require('../../utils/logger');

// Shared handler functions that work with both message and interaction contexts
async function handleSetSelfPrefix(context, newPrefix) {
  const user = context.user || context.author;

  if (!newPrefix) {
    return embeds.warn(context, "Please provide a prefix to set!");
  }

  if (newPrefix.length > 3) {
    return embeds.warn(context, "Prefix **can't** be over 3 characters.");
  }

  if (newPrefix.includes(' ')) {
    return embeds.warn(context, "Prefix **can't** contain spaces.");
  }

  try {
    const prefixService = getService('prefix');
    const success = await prefixService.setUserPrefix(user.id, newPrefix);
    if (success) {
      return embeds.success(context, `Your self prefix has been **set** to \`${newPrefix}\``);
    } else {
      return embeds.warn(context, "Failed to set self prefix. Please try again.");
    }
  } catch (error) {
    logger.webhook.error(error, context.message || context);
    return embeds.warn(context, "An error occurred while setting your prefix. Please try again.");
  }
}

async function handleRemoveSelfPrefix(context) {
  const user = context.user || context.author;

  try {
    const prefixService = getService('prefix');
    const success = await prefixService.clearUserPrefix(user.id);
    if (success) {
      return embeds.success(context, "Your self prefix has been **removed**!");
    } else {
      return embeds.warn(context, "Failed to remove self prefix. Please try again.");
    }
  } catch (error) {
    logger.webhook.error(error, context.message || context);
    return embeds.warn(context, "An error occurred while removing your prefix. Please try again.");
  }
}

async function handleViewSelfPrefix(context) {
  const user = context.user || context.author;

  try {
    const prefixService = getService('prefix');
    const userPrefix = await prefixService.getUserPrefix(user.id);

    const description = userPrefix
      ? `**Your self prefix:** \`${userPrefix}\``
      : `**Your self prefix:** **none**`;

    return embeds.info(context, description);
  } catch (error) {
    logger.webhook.error(error, context.message || context);
    return embeds.warn(context, 'Failed to retrieve your self prefix. Please try again.');
  }
}

module.exports = {
  name: "selfprefix",
  aliases: ['selfp'],
  description: `Manage your personal prefix`,
  isGroupCommand: true,

  // PREFIX COMMAND
  run: async (_, message, args) => {
    if (!args[0]) {
      return handleViewSelfPrefix(message);
    }

    // Handle subcommands
    if (args[0] === 'set') {
      return handleSetSelfPrefix(message, args[1]);
    } else if (args[0] === 'remove' || args[0] === 'clear') {
      return handleRemoveSelfPrefix(message);
    } else {
      return false;
    }
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('selfprefix')
    .setDescription('Manage your personal prefix')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('Shows your current personal prefix')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set your personal prefix')
        .addStringOption(option =>
          option
            .setName('prefix')
            .setDescription('The prefix to set')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove your personal prefix')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      return handleViewSelfPrefix(interaction);
    } else if (subcommand === 'set') {
      const newPrefix = interaction.options.getString('prefix');
      return handleSetSelfPrefix(interaction, newPrefix);
    } else if (subcommand === 'remove') {
      return handleRemoveSelfPrefix(interaction);
    }
  }
};
