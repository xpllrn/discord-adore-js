const { SlashCommandBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { hasDiscordPermission, PermissionFlagsBits } = require('../../utils/permissions');

// Shared handler functions that work with both message and interaction contexts
async function handleSetGuildPrefix(context, newPrefix) {
  const isInteraction = !!context.user;
  const member = isInteraction ? context.member : context.member;

  // Check if user has Administrator permission
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    return embeds.deny(context, 'You need **Administrator** permission to use this command.');
  }

  if (!newPrefix) {
    return embeds.warn(context, "Please provide a prefix to set!");
  }

  if (newPrefix.toLowerCase() === 'none') {
    return embeds.warn(context, "Server prefix cannot be removed!");
  }

  if (newPrefix.length > 3) {
    return embeds.warn(context, "Prefix **can't** be over 3 characters.");
  }

  if (newPrefix.includes(' ')) {
    return embeds.warn(context, "Prefix **can't** contain spaces.");
  }

  try {
    const prefixService = getService('prefix');
    const success = await prefixService.setGuildPrefix(context.guild.id, newPrefix);

    if (success) {
      return embeds.success(context, `Server prefix has been **changed** to \`${newPrefix}\``);
    } else {
      return embeds.warn(context, "Failed to update server prefix. Please try again.");
    }
  } catch (error) {
    return embeds.warn(context, "An error occurred while updating the prefix. Please try again.");
  }
}

async function handleRemoveGuildPrefix(context) {
  const isInteraction = !!context.user;
  const member = isInteraction ? context.member : context.member;

  // Check if user has Administrator permission
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    return embeds.deny(context, 'You need **Administrator** permission to use this command.');
  }

  try {
    const config = require('../../config/setup');
    const prefixService = getService('prefix');
    const defaultPrefix = config.bot.defaultPrefix;

    const success = await prefixService.setGuildPrefix(context.guild.id, defaultPrefix);

    if (success) {
      return embeds.success(context, `Server prefix has been **reset** to default \`${defaultPrefix}\``);
    } else {
      return embeds.warn(context, "Failed to reset server prefix. Please try again.");
    }
  } catch (error) {
    return embeds.warn(context, "An error occurred while resetting the prefix. Please try again.");
  }
}

async function handleViewGuildPrefix(context) {
  try {
    const prefixService = getService('prefix');
    const guildPrefix = await prefixService.getGuildPrefix(context.guild.id);
    const description = `Your Server **prefix:** \`${guildPrefix}\``;
    return embeds.info(context, description);
  } catch (error) {
    return embeds.warn(context, 'Failed to retrieve server prefix. Please try again.');
  }
}

module.exports = {
  name: "prefix",
  aliases: ['setprefix'],
  description: `Manage server prefix`,
  permission: 'Administrator',
  isGroupCommand: true,

  // PREFIX COMMAND
  run: async (_, message, args) => {
    if (!args[0]) {
      return handleViewGuildPrefix(message);
    }

    // Handle subcommands
    if (args[0] === 'set') {
      return handleSetGuildPrefix(message, args[1]);
    } else if (args[0] === 'remove' || args[0] === 'reset' || args[0] === 'default') {
      return handleRemoveGuildPrefix(message);
    } else {
      return false;
    }
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Manage server prefix')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('Shows the current server prefix')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Sets a new prefix for the server')
        .addStringOption(option =>
          option
            .setName('prefix')
            .setDescription('The new prefix to set')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Removes the custom prefix and resets to default')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      return handleViewGuildPrefix(interaction);
    } else if (subcommand === 'set') {
      const newPrefix = interaction.options.getString('prefix');
      return handleSetGuildPrefix(interaction, newPrefix);
    } else if (subcommand === 'remove') {
      return handleRemoveGuildPrefix(interaction);
    }
  }
};
