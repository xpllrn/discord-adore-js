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
  description: `set personal reminders with optional daily repeating`,
  isGroupCommand: true,
  run: async (client, message, args) => {

    if (args[0] === 'add') {
      args.shift(); // Remove "add" from args
      // Fall through to the reminder creation logic below

    } else if (args[0] === 'remove' || args[0] === 'delete' || args[0] === 'rm' || args[0] === 'del') {
      const reminderId = parseInt(args[1]);
      if (!reminderId || isNaN(reminderId)) {
        return runHelpCommand(message, 'remind');
      }
      return await handleReminderShared(message, 'remove', null, null, false, reminderId);

    } else if (args[0] === 'list' || !args[0]) {
      return await handleReminderShared(message, 'list', null, null, false, null);

    } else if (args[0] === 'reset' || args[0] === 'clear') {
      return await handleReminderShared(message, 'clear', null, null, false, null);
    }

    // Create a new reminder (handles both direct usage and "add" subcommand)
    if (args[0] !== 'list' && args[0] !== 'remove' && args[0] !== 'delete' && args[0] !== 'rm' && args[0] !== 'del' && args[0] !== 'reset' && args[0] !== 'clear') {
      let duration = null;
      let content = '';
      let isDaily = false;

      // Check for --daily flag
      const dailyFlagIndex = args.findIndex(arg => arg.toLowerCase() === '--daily');
      if (dailyFlagIndex !== -1) {
        isDaily = true;
        args.splice(dailyFlagIndex, 1); // Remove the flag from args
      }

      // Try to parse first argument as duration
      const firstArgDuration = ms(args[0]);

      if (firstArgDuration && firstArgDuration > 0) {
        // First argument is a duration
        duration = firstArgDuration;
        content = args.slice(1).join(' ');
      } else {
        // No duration specified, use default 1 hour
        duration = ms('1h');
        content = args.join(' ');
      }

      // Validate content
      if (!content || content.trim().length === 0) {
        return runHelpCommand(message, 'remind');
      }

      return await handleReminderShared(message, 'add', content, duration, isDaily, null);
    }
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