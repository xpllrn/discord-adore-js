const { SlashCommandBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { runHelpCommand } = require('../../utils/commandProcessor');
const logger = require('../../utils/logger');

module.exports = {
  name: "selfprefix",
  aliases: ['selfp'],
  description: 'Manage your personal prefix',
  syntax: 'selfprefix [subcommand] (prefix)',
  example: 'selfprefix set !',
  permission: 'premium_user',
  isGroupCommand: true,

  subcommands: {
    view: {
      name: 'view',
      aliases: [],
      description: 'Shows your current personal prefix',
      syntax: '{guildprefix}selfprefix view',
      parameters: [],
      example: '{guildprefix}selfprefix view',

      handler: async (client, message, args) => {
        const user = message.user || message.author;

        try {
          const prefixService = getService('prefix');
          const userPrefix = await prefixService.getUserPrefix(user.id);

          const description = userPrefix
            ? `**Your self prefix:** \`${userPrefix}\``
            : `**Your self prefix:** **none**`;

          return embeds.info(message, description, false);
        } catch (error) {
          logger.webhook.error(error, message.message || message);
          return embeds.warn(message, 'Failed to retrieve your self prefix. Please try again.', false);
        }
      }
    },

    set: {
      name: 'set',
      aliases: [],
      description: 'Set your personal prefix',
      syntax: '{guildprefix}selfprefix set [prefix]',
      parameters: ['prefix'],
      example: '{guildprefix}selfprefix set !',

      handler: async (client, message, args) => {
        const user = message.user || message.author;
        const newPrefix = args[0];

        if (!newPrefix) {
          return embeds.warn(message, "Please provide a prefix to set!", false);
        }

        if (newPrefix.length > 3) {
          return embeds.warn(message, "Prefix **can't** be over 3 characters.", false);
        }

        if (newPrefix.includes(' ')) {
          return embeds.warn(message, "Prefix **can't** contain spaces.", false);
        }

        try {
          const prefixService = getService('prefix');
          const success = await prefixService.setUserPrefix(user.id, newPrefix);
          if (success) {
            return embeds.success(message, `Your self prefix has been **set** to \`${newPrefix}\``, false);
          } else {
            return embeds.warn(message, "Failed to set self prefix. Please try again.", false);
          }
        } catch (error) {
          logger.webhook.error(error, message.message || message);
          return embeds.warn(message, "An error occurred while setting your prefix. Please try again.", false);
        }
      }
    },

    remove: {
      name: 'remove',
      aliases: ['clear'],
      description: 'Remove your personal prefix',
      syntax: '{guildprefix}selfprefix remove',
      parameters: [],
      example: '{guildprefix}selfprefix remove',

      handler: async (client, message, args) => {
        const user = message.user || message.author;

        try {
          const prefixService = getService('prefix');
          const success = await prefixService.clearUserPrefix(user.id);
          if (success) {
            return embeds.success(message, "Your self prefix has been **removed**!", false);
          } else {
            return embeds.warn(message, "Failed to remove self prefix. Please try again.", false);
          }
        } catch (error) {
          logger.webhook.error(error, message.message || message);
          return embeds.warn(message, "An error occurred while removing your prefix. Please try again.", false);
        }
      }
    }
  },

  run: async (client, message, args) => {
    const sub = args[0]?.toLowerCase();
    
    // Default to view if no subcommand
    if (!sub) {
      const viewSubcommand = module.exports.subcommands.view;
      return viewSubcommand.handler(client, message, []);
    }

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
    }

    return runHelpCommand(message, 'selfprefix');
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
      const viewHandler = module.exports.subcommands.view.handler;
      return viewHandler(interaction.client, interaction, []);
    } else if (subcommand === 'set') {
      const newPrefix = interaction.options.getString('prefix');
      const setHandler = module.exports.subcommands.set.handler;
      return setHandler(interaction.client, interaction, [newPrefix]);
    } else if (subcommand === 'remove') {
      const removeHandler = module.exports.subcommands.remove.handler;
      return removeHandler(interaction.client, interaction, []);
    }
  }
};
