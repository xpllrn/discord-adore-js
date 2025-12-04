const { EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureUserData } = require('../../../database');
const { createPagination, createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');
const ms = require('ms');
const logger = require('../../../utils/logger');

// Shared logic for reminder command
async function handleReminderShared(context, subcommand, content, duration, isDaily, reminderId) {
  const userService = getService('user');
  const isInteraction = !!context.user;
  const user = isInteraction ? context.user : context.author;
  const guild = isInteraction ? context.guild : context.guild;
  const channel = isInteraction ? context.channel : context.channel;

  // Ensure user data exists in the database
  await ensureUserData(user.id);

  try {
    if (subcommand === 'add') {
      // Validate content
      if (!content || content.trim().length === 0) {
        return embeds.warn(context, 'Reminder content cannot be empty', false);
      }

      if (content.length > 500) {
        return embeds.warn(context, 'Reminder content must be **500 characters or less**', false);
      }

      // Validate duration (minimum 1 minute, maximum 1 year)
      const minDuration = ms('1m');
      const maxDuration = ms('365d');

      if (duration < minDuration) {
        return embeds.warn(context, 'Reminder duration must be at least **1 minute**', false);
      }

      if (duration > maxDuration) {
        return embeds.warn(context, 'Reminder duration cannot exceed **1 year**', false);
      }

      const messageUrl = isInteraction ? null : context.url;
      const newReminder = await userService.addReminder(
        user.id,
        content,
        duration,
        isDaily,
        guild?.id,
        channel.id,
        messageUrl
      );

      const nextTrigger = `<t:${Math.floor(newReminder.nextTrigger.getTime() / 1000)}:R>`;

      if (isDaily) {
        if (isInteraction) {
          return context.reply(`ok ill remind u daily ${nextTrigger}`);
        } else {
          return context.channel.send(`ok ill remind u daily ${nextTrigger}`);
        }
      } else {
        if (isInteraction) {
          return context.reply(`ok ill remind u ${nextTrigger}`);
        } else {
          return context.channel.send(`ok ill remind u ${nextTrigger}`);
        }
      }

    } else if (subcommand === 'remove') {
      if (!reminderId || isNaN(reminderId)) {
        return embeds.warn(context, 'Please provide a valid reminder ID', false);
      }

      const removedReminder = await userService.removeReminder(user.id, reminderId);

      if (removedReminder) {
        return embeds.success(context, `Removed reminder **#${reminderId}**`, false);
      } else {
        return embeds.warn(context, `No reminder found with ID **#${reminderId}**`, false);
      }

    } else if (subcommand === 'list') {
      const reminders = await userService.getReminders(user.id);

      if (!reminders || reminders.length === 0) {
        return embeds.info(context, 'You have no active reminders', false);
      }

      const sortedReminders = reminders.sort((a, b) => a.nextTrigger.getTime() - b.nextTrigger.getTime());

      const formatPage = (pageReminders, currentPage, totalPages) => {
        const remindersList = pageReminders.map((reminder) => {
          const number = reminder.id.toString().padStart(2, '0');
          const nextTrigger = `<t:${Math.floor(reminder.nextTrigger.getTime() / 1000)}:R>`;
          const content = reminder.content.length > 50 ?
            reminder.content.substring(0, 50) + '...' :
            reminder.content;
          const dailyIndicator = reminder.isDaily ? ' 🔄' : '';

          return `\`${number}\` **${content}**${dailyIndicator} ${nextTrigger}`;
        }).join('\n');

        return new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle('Your Reminders')
          .setDescription(remindersList)
          .setFooter({ text: `${sortedReminders.length} reminders • Page ${currentPage}/${totalPages}` });
      };

      await createPagination(context, sortedReminders, formatPage, 10, 'Reminders');

    } else if (subcommand === 'clear') {
      const reminders = await userService.getReminders(user.id);

      if (!reminders || reminders.length === 0) {
        return embeds.warn(context, 'You have no reminders to clear', false);
      }

      await createConfirmation(
        context,
        `Are you sure you want to **remove all ${reminders.length} reminders**?`,
        async (interaction) => {
          await userService.clearReminders(user.id);
          const successEmbed = embeds.createSuccess(context, 'Cleared all your reminders');
          await interaction.editReply({ embeds: [successEmbed], components: [] });
        }
      );
    }
  } catch (error) {
    logger.webhook.error(error, context);
    return embeds.deny(context, 'Failed to process reminder command', false);
  }
}

module.exports = {
  name: "remind",
  aliases: ['reminder', 'remindme'],
  description: 'Set personal reminders with optional daily repeating',
  syntax: 'remind [subcommand|duration] (content)',
  example: 'remind 1h buy milk',
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: [],
      description: 'Create a new reminder',
      syntax: '{guildprefix}remind add [duration] [content] [--daily]',
      parameters: ['duration', 'content'],
      example: '{guildprefix}remind add 1h buy milk --daily',

      handler: async (client, message, args) => {
        let duration = null;
        let content = '';
        let isDaily = false;

        // Check for --daily flag
        const dailyFlagIndex = args.findIndex(arg => arg.toLowerCase() === '--daily');
        if (dailyFlagIndex !== -1) {
          isDaily = true;
          args.splice(dailyFlagIndex, 1);
        }

        // Try to parse first argument as duration
        const firstArgDuration = ms(args[0]);

        if (firstArgDuration && firstArgDuration > 0) {
          duration = firstArgDuration;
          content = args.slice(1).join(' ');
        } else {
          duration = ms('1h');
          content = args.join(' ');
        }

        if (!content || content.trim().length === 0) {
          return runHelpCommand(message, 'remind');
        }

        return await handleReminderShared(message, 'add', content, duration, isDaily, null);
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete', 'rm', 'del'],
      description: 'Remove a reminder by ID',
      syntax: '{guildprefix}remind remove [id]',
      parameters: ['id'],
      example: '{guildprefix}remind remove 1',

      handler: async (client, message, args) => {
        const reminderId = parseInt(args[0]);
        if (!reminderId || isNaN(reminderId)) {
          return runHelpCommand(message, 'remind');
        }
        return await handleReminderShared(message, 'remove', null, null, false, reminderId);
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'List all your reminders',
      syntax: '{guildprefix}remind list',
      parameters: [],
      example: '{guildprefix}remind list',

      handler: async (client, message, args) => {
        return await handleReminderShared(message, 'list', null, null, false, null);
      }
    },

    clear: {
      name: 'clear',
      aliases: ['reset'],
      description: 'Clear all your reminders',
      syntax: '{guildprefix}remind clear',
      parameters: [],
      example: '{guildprefix}remind clear',

      handler: async (client, message, args) => {
        return await handleReminderShared(message, 'clear', null, null, false, null);
      }
    }
  },

  run: async (client, message, args) => {
    const sub = args[0]?.toLowerCase();
    
    // Default to list if no subcommand
    if (!sub) {
      return module.exports.subcommands.list.handler(client, message, []);
    }

    // Check if it's a known subcommand
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
    }

    // If not a subcommand, treat as direct reminder creation (backward compatibility)
    return module.exports.subcommands.add.handler(client, message, args);
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Manage your personal reminders')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Create a new reminder')
        .addStringOption(option =>
          option
            .setName('content')
            .setDescription('What to remind you about')
            .setRequired(true)
            .setMaxLength(500)
        )
        .addStringOption(option =>
          option
            .setName('duration')
            .setDescription('When to remind you (e.g., 1h, 30m, 2d) - default is 1h')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('daily')
            .setDescription('Repeat this reminder daily')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a reminder by ID')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('The ID of the reminder to remove')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all your reminders')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('clear')
        .setDescription('Clear all your reminders')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const content = interaction.options.getString('content');
    const durationStr = interaction.options.getString('duration');
    const isDaily = interaction.options.getBoolean('daily') || false;
    const reminderId = interaction.options.getInteger('id');

    let duration = ms('1h'); // Default duration

    if (durationStr) {
      const parsedDuration = ms(durationStr);
      if (!parsedDuration || parsedDuration <= 0) {
        return embeds.warn(interaction, 'Invalid duration format. Use formats like: 1h, 30m, 2d, 1w', false);
      }
      duration = parsedDuration;
    }

    return await handleReminderShared(interaction, subcommand, content, duration, isDaily, reminderId);
  }
}