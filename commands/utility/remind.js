const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { ensureUserData } = require('../../database');
const { createPagination, createConfirmation } = require('../../core/buttons');
const { getService } = require('@services');
const config = require('../../config/setup');
const ms = require('ms');

module.exports = {
  name: "remind",
  aliases: ['reminder', 'remindme'],
  description: `set personal reminders with optional daily repeating`,
  isGroupCommand: true,
  run: async (client, message, args) => {

    // Ensure user data exists in the database
    await ensureUserData(message.author.id);

    if (args[0] === 'list' || !args[0]) {
      const subcommandInfo = {
        description: 'List all your reminders',
        usage: '{guildprefix}remind list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}remind list'
      };

      // List user's reminders
      try {
        const userService = getService('user');
        const reminders = await userService.getReminders(message.author.id);

        if (!reminders || reminders.length === 0) {
          return embeds.info(message, 'You have no active reminders');
        }

        // Sort reminders by next trigger time
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

        await createPagination(message, sortedReminders, formatPage, 10, 'Reminders');
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, 'Failed to retrieve reminders');
      }

    } else if (args[0] === 'remove' || args[0] === 'delete' || args[0] === 'rm' || args[0] === 'del') {
      const subcommandInfo = {
        description: 'Remove a specific reminder',
        usage: '{guildprefix}remind remove [id]',
        aliases: ['delete', 'rm', 'del'],
        parameters: ['id'],
        example: '{guildprefix}remind remove 1'
      };

      // Remove a specific reminder
      const reminderId = parseInt(args[1]);

      if (!reminderId || isNaN(reminderId)) {
        return runHelpCommand(message, 'remind');
      }

      try {
        const userService = getService('user');
        const removedReminder = await userService.removeReminder(message.author.id, reminderId);

        if (removedReminder) {
          return embeds.success(message, `Removed reminder **#${reminderId}**`);
        } else {
          return embeds.warn(message, `No reminder found with ID **#${reminderId}**`);
        }
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, 'Failed to remove reminder');
      }

    } else if (args[0] === 'reset' || args[0] === 'clear') {
      const subcommandInfo = {
        description: 'Clear all your reminders',
        usage: '{guildprefix}remind reset',
        aliases: ['clear'],
        parameters: [],
        example: '{guildprefix}remind reset'
      };

      // Clear all reminders
      try {
        const userService = getService('user');
        const reminders = await userService.getReminders(message.author.id);

        if (!reminders || reminders.length === 0) {
          return embeds.warn(message, 'You have no reminders to clear');
        }

        await createConfirmation(
          message,
          `Are you sure you want to **remove all ${reminders.length} reminders**?`,
          async (interaction) => {
            // Ensure cache writes are enabled before clearing
            await userService.clearReminders(message.author.id);
            const successEmbed = embeds.createSuccess(message, 'Cleared all your reminders');
            await interaction.editReply({ embeds: [successEmbed], components: [] });
          }
        );
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, 'Failed to clear reminders');
      }

    } else if (args[0] === 'add') {
      const subcommandInfo = {
        description: 'Create a new reminder',
        usage: '{guildprefix}remind add [duration] [content] [--daily]',
        aliases: [],
        parameters: ['duration (optional)', 'content', '--daily (optional)'],
        example: '{guildprefix}remind add 1h Take a break --daily'
      };

      // Handle "add" subcommand - shift args and process normally
      args.shift(); // Remove "add" from args
      // Fall through to the reminder creation logic below
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

      if (content.length > 500) {
        return embeds.warn(message, 'Reminder content must be **500 characters or less**');
      }

      // Validate duration (minimum 1 minute, maximum 1 year)
      const minDuration = ms('1m');
      const maxDuration = ms('365d');

      if (duration < minDuration) {
        return embeds.warn(message, 'Reminder duration must be at least **1 minute**');
      }

      if (duration > maxDuration) {
        return embeds.warn(message, 'Reminder duration cannot exceed **1 year**');
      }

      try {
        // Ensure cache writes are enabled before saving
        const userService = getService('user');
        const newReminder = await userService.addReminder(
          message.author.id,
          content,
          duration,
          isDaily,
          message.guild?.id,
          message.channel.id,
          message.url
        );
        const nextTrigger = `<t:${Math.floor(newReminder.nextTrigger.getTime() / 1000)}:R>`;

        if (isDaily) {
          return message.channel.send(`ok ill remind u daily ${nextTrigger}`);
        } else {
          return message.channel.send(`ok ill remind u ${nextTrigger}`);
        }
      } catch (error) {
        logger.webhook.error(error, message);
        return embeds.deny(message, 'Failed to create reminder');
      }
    }
  }
}