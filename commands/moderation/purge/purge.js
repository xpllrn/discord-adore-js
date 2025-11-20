const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

module.exports = {
  name: "purge",
  aliases: ['clear', 'c'],
  description: `bulk delete messages from a channel`,
  permission: 'Manage Messages',
  isGroupCommand: true,
  run: async(client, message, args) => {
    try {
      if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return embeds.deny(message, 'I need **Manage Messages** permission to use this command');
      }

      // Helper function to validate and cap numbers
      const validateNumber = (input, defaultValue = 50) => {
        if (!input) return defaultValue;
        const num = parseInt(input);
        if (isNaN(num) || num < 1) return null; // Invalid input
        // Cap at 1000, but we'll handle it in batches
        return Math.min(num, 1000);
      };

      // Helper function to fetch messages in batches
      const fetchMessagesInBatches = async (amount, filter = null) => {
        let allMessages = new Map();
        let lastId = null;
        let remaining = amount;

        while (remaining > 0 && allMessages.size < amount) {
          const fetchAmount = Math.min(remaining, 100);
          const options = { limit: fetchAmount };
          if (lastId) options.before = lastId;

          const fetched = await message.channel.messages.fetch(options);
          if (fetched.size === 0) break;

          // Apply filter if provided
          const filtered = filter ? fetched.filter(filter) : fetched;
          filtered.forEach((msg, id) => allMessages.set(id, msg));

          lastId = fetched.last().id;
          remaining -= fetched.size;

          // If we didn't get a full batch, we've reached the end
          if (fetched.size < fetchAmount) break;
        }

        return allMessages;
      };

      // Helper function to perform bulk delete with error handling
      const performBulkDelete = async (messagesToDelete) => {
        try {
          if (messagesToDelete.size === 0) {
            return 0; // No messages to delete
          }

          // Delete in batches of 100 (Discord limit)
          const messageArray = Array.from(messagesToDelete.values());
          let deletedCount = 0;

          for (let i = 0; i < messageArray.length; i += 100) {
            const batch = messageArray.slice(i, i + 100);
            
            try {
              // bulkDelete returns a collection of deleted messages
              const deleted = await message.channel.bulkDelete(batch, true);
              deletedCount += deleted.size;
            } catch (batchError) {
              // If a batch fails with Unknown Message error, try deleting individually
              if (batchError.code === 10008) {
                for (const msg of batch) {
                  try {
                    await msg.delete();
                    deletedCount++;
                  } catch (individualError) {
                    // Skip messages that can't be deleted
                    if (individualError.code !== 10008) {
                      throw individualError;
                    }
                  }
                }
              } else {
                throw batchError;
              }
            }
          }

          return deletedCount;

        } catch (error) {
          logger.webhook.error(error, message);
          if (error.code === 50034) {
            embeds.deny(message, 'Cannot delete messages **older than 14 days** due to Discord limitations.');
          } else if (error.code === 50013) {
            embeds.deny(message, 'I don\'t have permission to delete messages in this channel.');
          } else if (error.code === 10008) {
            embeds.deny(message, 'Some messages could not be found (they may have been deleted).');
          } else {
            embeds.deny(message, `An error occurred while trying to purge messages: ${error.message}`);
          }
          return 0;
        }
      };

      // Handle different purge types
      if (args[0] === 'bots') {
        const subcommandInfo = {
          description: 'Delete messages from bots only',
          usage: '{guildprefix}purge bots [number]',
          aliases: [],
          parameters: ['number'],
          example: '{guildprefix}purge bots 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.author.bot);
        await performBulkDelete(messages);

      } else if (args[0] === 'humans') {
        const subcommandInfo = {
          description: 'Delete messages from humans only',
          usage: '{guildprefix}purge humans [number]',
          aliases: [],
          parameters: ['number'],
          example: '{guildprefix}purge humans 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => !msg.author.bot);
        await performBulkDelete(messages);

      } else if (args[0] === 'media') {
        const subcommandInfo = {
          description: 'Delete messages with attachments or embeds',
          usage: '{guildprefix}purge media [number]',
          aliases: [],
          parameters: ['number'],
          example: '{guildprefix}purge media 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.attachments.size > 0 || msg.embeds.length > 0);
        await performBulkDelete(messages);

      } else if (args[0] === 'between') {
        const subcommandInfo = {
          description: 'Delete messages between two message IDs',
          usage: '{guildprefix}purge between [topMsgID] [lastMsgID]',
          aliases: [],
          parameters: ['topMsgID', 'lastMsgID'],
          example: '{guildprefix}purge between 123456789 987654321'
        };

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

          // Include the command message in deletion
          messages.set(message.id, message);
          await performBulkDelete(messages);

        } catch (error) {
          embeds.deny(message, 'Invalid message IDs provided or messages not found.');
        }

      } else if (message.mentions.users.size > 0) {
        // Purge messages from mentioned user
        const targetUser = message.mentions.users.first();
        const numberArg = args[1];
        const number = validateNumber(numberArg);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.author.id === targetUser.id);
        await performBulkDelete(messages);

      } else {
        // Default purge - just delete X number of messages
        const number = validateNumber(args[0]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number + 1); // +1 to include command message
        await performBulkDelete(messages);
      }
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while executing the purge command');
    }
  }
}
