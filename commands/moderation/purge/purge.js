const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

module.exports = {
  name: "purge",
  aliases: ['clear', 'c'],
  description: `bulk delete messages from a channel`,
  syntax: 'purge [number/subcommand] (parameters)',
  example: 'purge 50',
  permission: 'manage_messages',
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
        let totalFetched = 0;
        const maxFetch = 1000; // Safety limit

        while (allMessages.size < amount && totalFetched < maxFetch) {
          const fetchAmount = Math.min(100, maxFetch - totalFetched);
          const options = { limit: fetchAmount };
          if (lastId) options.before = lastId;

          const fetched = await message.channel.messages.fetch(options);
          if (fetched.size === 0) break;

          totalFetched += fetched.size;

          // Apply filter if provided
          const filtered = filter ? fetched.filter(filter) : fetched;
          filtered.forEach((msg, id) => {
            if (allMessages.size < amount) {
              allMessages.set(id, msg);
            }
          });

          lastId = fetched.last().id;

          // If we didn't get a full batch, we've reached the end
          if (fetched.size < fetchAmount) break;
          
          // If no filter and we have enough, stop
          if (!filter && allMessages.size >= amount) break;
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
          syntax: '{guildprefix}purge bots [number]',
          aliases: [],
          parameters: ['number'],
          example: '{guildprefix}purge bots 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.author.bot);
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'humans') {
        const subcommandInfo = {
          description: 'Delete messages from humans only',
          syntax: '{guildprefix}purge humans [number]',
          aliases: [],
          parameters: ['number'],
          example: '{guildprefix}purge humans 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => !msg.author.bot);
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'media') {
        const subcommandInfo = {
          description: 'Delete messages with attachments or embeds',
          syntax: '{guildprefix}purge media [number]',
          aliases: [],
          parameters: ['number'],
          example: '{guildprefix}purge media 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.attachments.size > 0 || msg.embeds.length > 0);
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'between') {
        const subcommandInfo = {
          description: 'Delete messages between two message IDs',
          syntax: '{guildprefix}purge between [topMsgID] [lastMsgID]',
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

      } else if (args[0] === 'after') {
        const subcommandInfo = {
          description: 'Delete messages after a message link',
          syntax: '{guildprefix}purge after [message link]',
          aliases: [],
          parameters: ['message link'],
          example: '{guildprefix}purge after https://discord.com/channels/...'
        };

        if (!args[1]) {
          return runHelpCommand(message, 'purge');
        }

        const messageLink = args[1];
        const messageLinkRegex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
        const match = messageLink.match(messageLinkRegex);

        if (!match) {
          return embeds.deny(message, 'Invalid message link provided');
        }

        const [, guildId, channelId, messageId] = match;

        if (guildId !== message.guild.id || channelId !== message.channel.id) {
          return embeds.deny(message, 'Message link must be from this channel');
        }

        try {
          const messages = await message.channel.messages.fetch({ after: messageId, limit: 100 });
          messages.set(message.id, message);
          await performBulkDelete(messages);
        } catch (error) {
          embeds.deny(message, 'Failed to fetch messages after the provided link');
        }

      } else if (args[0] === 'before') {
        const subcommandInfo = {
          description: 'Delete messages before a message link',
          syntax: '{guildprefix}purge before [message link]',
          aliases: [],
          parameters: ['message link'],
          example: '{guildprefix}purge before https://discord.com/channels/...'
        };

        if (!args[1]) {
          return runHelpCommand(message, 'purge');
        }

        const messageLink = args[1];
        const messageLinkRegex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
        const match = messageLink.match(messageLinkRegex);

        if (!match) {
          return embeds.deny(message, 'Invalid message link provided');
        }

        const [, guildId, channelId, messageId] = match;

        if (guildId !== message.guild.id || channelId !== message.channel.id) {
          return embeds.deny(message, 'Message link must be from this channel');
        }

        try {
          const messages = await message.channel.messages.fetch({ before: messageId, limit: 100 });
          messages.set(message.id, message);
          await performBulkDelete(messages);
        } catch (error) {
          embeds.deny(message, 'Failed to fetch messages before the provided link');
        }

      } else if (args[0] === 'webhooks') {
        const subcommandInfo = {
          description: 'Delete messages from webhooks',
          syntax: '{guildprefix}purge webhooks [amount]',
          aliases: [],
          parameters: ['amount'],
          example: '{guildprefix}purge webhooks 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.webhookId !== null);
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'links') {
        const subcommandInfo = {
          description: 'Delete messages containing links',
          syntax: '{guildprefix}purge links [amount]',
          aliases: [],
          parameters: ['amount'],
          example: '{guildprefix}purge links 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const messages = await fetchMessagesInBatches(number, msg => urlRegex.test(msg.content));
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'startswith') {
        const subcommandInfo = {
          description: 'Delete messages starting with a substring',
          syntax: '{guildprefix}purge startswith [substring] [search]',
          aliases: [],
          parameters: ['substring', 'search'],
          example: '{guildprefix}purge startswith hello 100'
        };

        if (!args[1] || !args[2]) {
          return runHelpCommand(message, 'purge');
        }

        const substring = args[1].toLowerCase();
        const number = validateNumber(args[2]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.content.toLowerCase().startsWith(substring));
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'endswith') {
        const subcommandInfo = {
          description: 'Delete messages ending with a substring',
          syntax: '{guildprefix}purge endswith [substring] [search]',
          aliases: [],
          parameters: ['substring', 'search'],
          example: '{guildprefix}purge endswith hello 100'
        };

        if (!args[1] || !args[2]) {
          return runHelpCommand(message, 'purge');
        }

        const substring = args[1].toLowerCase();
        const number = validateNumber(args[2]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.content.toLowerCase().endsWith(substring));
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'contains') {
        const subcommandInfo = {
          description: 'Delete messages containing a substring',
          syntax: '{guildprefix}purge contains [substring] [search]',
          aliases: [],
          parameters: ['substring', 'search'],
          example: '{guildprefix}purge contains hello 100'
        };

        if (!args[1] || !args[2]) {
          return runHelpCommand(message, 'purge');
        }

        const substring = args[1].toLowerCase();
        const number = validateNumber(args[2]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.content.toLowerCase().includes(substring));
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'reactions') {
        const subcommandInfo = {
          description: 'Delete messages with reactions',
          syntax: '{guildprefix}purge reactions [amount]',
          aliases: [],
          parameters: ['amount'],
          example: '{guildprefix}purge reactions 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.reactions.cache.size > 0);
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'stickers') {
        const subcommandInfo = {
          description: 'Delete messages with stickers',
          syntax: '{guildprefix}purge stickers [amount]',
          aliases: [],
          parameters: ['amount'],
          example: '{guildprefix}purge stickers 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.stickers.size > 0);
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'emoji' || args[0] === 'emote') {
        const subcommandInfo = {
          description: 'Delete messages containing emojis',
          syntax: '{guildprefix}purge emoji [amount]',
          aliases: [],
          parameters: ['amount'],
          example: '{guildprefix}purge emoji 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const emojiRegex = /<a?:\w+:\d+>|[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu;
        const messages = await fetchMessagesInBatches(number, msg => emojiRegex.test(msg.content));
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'mentions') {
        const subcommandInfo = {
          description: 'Delete messages mentioning a specific member',
          syntax: '{guildprefix}purge mentions [member] [search] OR {guildprefix}purge mentions @user [search]',
          aliases: [],
          parameters: ['member', 'search'],
          example: '{guildprefix}purge mentions @user 100'
        };

        // Support both: purge mentions @user 100 and purge mentions user 100
        let targetUserId;
        let numberArg;

        if (message.mentions.users.size > 0) {
          // Format: purge mentions @user 100
          targetUserId = message.mentions.users.first().id;
          numberArg = args[2];
        } else {
          // Format: purge mentions user 100
          if (!args[1] || !args[2]) {
            return runHelpCommand(message, 'purge');
          }

          const { findUser } = require('../../../handlers/finder');
          const userResult = await findUser(message.guild, args[1], client);

          if (!userResult.found) {
            return embeds.deny(message, userResult.error);
          }

          if (userResult.isGlobal) {
            return embeds.deny(message, `I was unable to find a **user** in this server with the name: **${args[1]}**`);
          }

          targetUserId = userResult.user.user.id;
          numberArg = args[2];
        }

        const number = validateNumber(numberArg);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.mentions.users.has(targetUserId));
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'embeds') {
        const subcommandInfo = {
          description: 'Delete messages with embeds',
          syntax: '{guildprefix}purge embeds [amount]',
          aliases: [],
          parameters: ['amount'],
          example: '{guildprefix}purge embeds 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.embeds.length > 0);
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'files') {
        const subcommandInfo = {
          description: 'Delete messages with file attachments (excluding images)',
          syntax: '{guildprefix}purge files [amount]',
          aliases: [],
          parameters: ['amount'],
          example: '{guildprefix}purge files 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
        const messages = await fetchMessagesInBatches(number, msg => {
          if (msg.attachments.size === 0) return false;
          // Only include if has non-image attachments
          return msg.attachments.some(att => !imageExtensions.some(ext => att.name.toLowerCase().endsWith(ext)));
        });
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (args[0] === 'images') {
        const subcommandInfo = {
          description: 'Delete messages with image attachments',
          syntax: '{guildprefix}purge images [amount]',
          aliases: [],
          parameters: ['amount'],
          example: '{guildprefix}purge images 50'
        };

        const number = validateNumber(args[1]);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
        const messages = await fetchMessagesInBatches(number, msg => {
          return msg.attachments.some(att => imageExtensions.some(ext => att.name.toLowerCase().endsWith(ext)));
        });
        messages.set(message.id, message); // Include command message
        await performBulkDelete(messages);

      } else if (message.mentions.users.size > 0) {
        // Purge messages from mentioned user
        const targetUser = message.mentions.users.first();
        const numberArg = args[1];
        const number = validateNumber(numberArg);
        if (number === null) {
          return runHelpCommand(message, 'purge');
        }

        const messages = await fetchMessagesInBatches(number, msg => msg.author.id === targetUser.id);
        messages.set(message.id, message); // Include command message
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
      throw error;
    }
  }
}
