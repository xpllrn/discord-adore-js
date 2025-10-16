const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');

module.exports = {
  name: "purge",
  aliases: ['clear', 'c'],
  description: `bulk delete messages from a channel`,
  usage: `{guildprefix}purge [number]
{guildprefix}purge bots [number]
{guildprefix}purge humans [number]
{guildprefix}purge @user [number]
{guildprefix}purge media [number]
{guildprefix}purge between [topMsgID] [lastMsgID]`,
  permission: 'Manage Messages',
  run: async(client, message, args) => {

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return embeds.deny(message, 'I need **Manage Messages** permission to use this command');
    }

    // Helper function to validate and cap numbers
    const validateNumber = (input, defaultValue = 50) => {
      if (!input) return defaultValue;
      const num = parseInt(input);
      if (isNaN(num) || num < 1) return null; // Invalid input
      return Math.min(num, 500); // Cap at 500
    };

    // Helper function to perform bulk delete with error handling
    const performBulkDelete = async (messagesToDelete) => {
      try {
        if (messagesToDelete.size === 0) {
          return; // Silent fail - no messages to delete
        }

        await message.channel.bulkDelete(messagesToDelete, true);
        // No confirmation message - delete silently

      } catch (error) {
        if (error.code === 50034) {
          embeds.deny(message, 'Cannot delete messages **older than 14 days** due to Discord limitations.');
        } else {
          embeds.deny(message, 'An error occurred while trying to purge messages.');
        }
      }
    };

    // Handle different purge types
    if (args[0] === 'bots') {
      const number = validateNumber(args[1]);
      if (number === null) {
        return runHelpCommand(message, 'purge');
      }

      const messages = await message.channel.messages.fetch({ limit: number });
      const botMessages = messages.filter(msg => msg.author.bot);

      await performBulkDelete(botMessages);

    } else if (args[0] === 'humans') {
      const number = validateNumber(args[1]);
      if (number === null) {
        return runHelpCommand(message, 'purge');
      }

      const messages = await message.channel.messages.fetch({ limit: number });
      const humanMessages = messages.filter(msg => !msg.author.bot);

      await performBulkDelete(humanMessages);

    } else if (args[0] === 'media') {
      const number = validateNumber(args[1]);
      if (number === null) {
        return runHelpCommand(message, 'purge');
      }

      const messages = await message.channel.messages.fetch({ limit: number });
      const mediaMessages = messages.filter(msg => msg.attachments.size > 0 || msg.embeds.length > 0);

      await performBulkDelete(mediaMessages);

    } else if (args[0] === 'between') {
      if (!args[1] || !args[2]) {
        return runHelpCommand(message, 'purge');
      }

      const topMsgId = args[1];
      const lastMsgId = args[2];

      try {
        // Fetch messages between the two IDs
        const messages = await message.channel.messages.fetch({ 
          after: lastMsgId,
          before: topMsgId,
          limit: 100 
        });

        if (messages.size === 0) {
          return; // Silent fail - no messages found
        }

        await performBulkDelete(messages);

      } catch (error) {
        embeds.deny(message, 'Invalid message IDs provided or messages not found.');
      }

    } else if (message.mentions.users.size > 0) {
      // Purge messages from mentioned user
      const targetUser = message.mentions.users.first();
      const number = validateNumber(args[1]);
      if (number === null) {
        return runHelpCommand(message, 'purge');
      }

      const messages = await message.channel.messages.fetch({ limit: number });
      const userMessages = messages.filter(msg => msg.author.id === targetUser.id);

      await performBulkDelete(userMessages);

    } else {
      // Default purge - just delete X number of messages
      const number = validateNumber(args[0]);
      if (number === null) {
        return runHelpCommand(message, 'purge');
      }

      try {
        const messages = await message.channel.messages.fetch({ limit: number });
        await performBulkDelete(messages);
      } catch (error) {
        embeds.deny(message, 'An error occurred while trying to purge messages.');
      }
    }
  }
}
