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
    return embeds.deny(context, 'You need **Administrator** permission to use this command.', false);
  }

  if (!newPrefix) {
    return embeds.warn(context, "Please provide a prefix to set!", false);
  }

  if (newPrefix.toLowerCase() === 'none') {
    return embeds.warn(context, "Server prefix cannot be removed!", false);
  }

  if (newPrefix.length > 3) {
    return embeds.warn(context, "Prefix **can't** be over 3 characters.", false);
  }

  if (newPrefix.includes(' ')) {
    return embeds.warn(context, "Prefix **can't** contain spaces.", false);
  }

  try {
    const prefixService = getService('prefix');
    const success = await prefixService.setGuildPrefix(context.guild.id, newPrefix);

    if (success) {
      return embeds.success(context, `Server prefix has been **changed** to \`${newPrefix}\``, false);
    } else {
      return embeds.warn(context, "Failed to update server prefix. Please try again.", false);
    }
  } catch (error) {
    return embeds.warn(context, "An error occurred while updating the prefix. Please try again.", false);
  }
}

async function handleRemoveGuildPrefix(context) {
  const isInteraction = !!context.user;
  const member = isInteraction ? context.member : context.member;

  // Check if user has Administrator permission
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    return embeds.deny(context, 'You need **Administrator** permission to use this command.', false);
  }

  try {
    const config = require('../../config/setup');
    const prefixService = getService('prefix');
    const defaultPrefix = config.bot.defaultPrefix;

    const success = await prefixService.setGuildPrefix(context.guild.id, defaultPrefix);

    if (success) {
      return embeds.success(context, `Server prefix has been **reset** to default \`${defaultPrefix}\``, false);
    } else {
      return embeds.warn(context, "Failed to reset server prefix. Please try again.", false);
    }
  } catch (error) {
    return embeds.warn(context, "An error occurred while resetting the prefix. Please try again.", false);
  }
}

async function handleViewGuildPrefix(context) {
  try {
    const prefixService = getService('prefix');
    const guildPrefix = await prefixService.getGuildPrefix(context.guild.id);
    const description = `Your Server **prefix:** \`${guildPrefix}\``;
    return embeds.info(context, description, false);
  } catch (error) {
    return embeds.warn(context, 'Failed to retrieve server prefix. Please try again.', false);
  }
}

module.exports = {
  name: "prefix",
  aliases: ['setprefix'],
  description: `Manage server prefix`,
  permission: 'administrator',
  isGroupCommand: true,
  syntax: 'prefix [subcommand] (value)',
  example: 'prefix set !',

  // PREFIX COMMAND
  run: async (_, message, args) => {
    if (!args[0]) {
      const { runHelpCommand } = require('../../utils/commandProcessor');
      return runHelpCommand(message, 'prefix');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'view': {
        const subcommandInfo = {
          description: 'View the current server prefix',
          usage: '{guildprefix}prefix view',
          aliases: [],
          example: '{guildprefix}prefix view'
        };
        return handleViewGuildPrefix(message);
      }

      case 'set': {
        const subcommandInfo = {
          description: 'Set a new server prefix',
          usage: '{guildprefix}prefix set [prefix]',
          aliases: [],
          example: '{guildprefix}prefix set !'
        };
        return handleSetGuildPrefix(message, args[1]);
      }

      case 'remove':
      case 'reset':
      case 'default': {
        const subcommandInfo = {
          description: 'Reset server prefix to default',
          usage: '{guildprefix}prefix remove',
          aliases: ['reset', 'default'],
          example: '{guildprefix}prefix remove'
        };
        return handleRemoveGuildPrefix(message);
      }

      default: {
        const { runHelpCommand } = require('../../utils/commandProcessor');
        return runHelpCommand(message, 'prefix');
      }
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
