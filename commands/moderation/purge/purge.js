const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

// Helper function to validate and cap numbers
const validateNumber = (input, defaultValue = 50) => {
  if (!input) return defaultValue;
  const num = parseInt(input);
  if (isNaN(num) || num < 1) return null;
  return Math.min(num, 1000);
};

// Helper function to fetch messages in batches
const fetchMessagesInBatches = async (channel, amount, filter = null) => {
  let allMessages = new Map();
  let lastId = null;
  let totalFetched = 0;
  const maxFetch = 1000;

  while (allMessages.size < amount && totalFetched < maxFetch) {
    const fetchAmount = Math.min(100, maxFetch - totalFetched);
    const options = { limit: fetchAmount };
    if (lastId) options.before = lastId;

    const fetched = await channel.messages.fetch(options);
    if (fetched.size === 0) break;

    totalFetched += fetched.size;
    const filtered = filter ? fetched.filter(filter) : fetched;
    filtered.forEach((msg, id) => {
      if (allMessages.size < amount) {
        allMessages.set(id, msg);
      }
    });

    lastId = fetched.last().id;
    if (fetched.size < fetchAmount) break;
    if (!filter && allMessages.size >= amount) break;
  }

  return allMessages;
};

// Helper function to perform bulk delete with error handling
const performBulkDelete = async (message, messagesToDelete) => {
  try {
    if (messagesToDelete.size === 0) return 0;

    const messageArray = Array.from(messagesToDelete.values());
    let deletedCount = 0;

    for (let i = 0; i < messageArray.length; i += 100) {
      const batch = messageArray.slice(i, i + 100);

      try {
        const deleted = await message.channel.bulkDelete(batch, true);
        deletedCount += deleted.size;
      } catch (batchError) {
        if (batchError.code === 10008) {
          for (const msg of batch) {
            try {
              await msg.delete();
              deletedCount++;
            } catch (individualError) {
              if (individualError.code !== 10008) throw individualError;
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

module.exports = {
  name: "purge",
  aliases: ['clear', 'c'],
  description: `bulk delete messages from a channel`,
  syntax: 'purge [number/subcommand] (parameters)',
  example: 'purge 50',
  permission: 'manage_messages',
  isGroupCommand: true,

  subcommands: {
    bots: {
      name: 'bots',
      aliases: [],
      description: 'Delete messages from bots only',
      syntax: '{guildprefix}purge bots [number]',
      parameters: ['number'],
      example: '{guildprefix}purge bots 50',
      handler: async (client, message, args) => {
        const number = validateNumber(args[0]);
        if (number === null) return runHelpCommand(message, 'purge');
        const messages = await fetchMessagesInBatches(message.channel, number, msg => msg.author.bot);
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    humans: {
      name: 'humans',
      aliases: [],
      description: 'Delete messages from humans only',
      syntax: '{guildprefix}purge humans [number]',
      parameters: ['number'],
      example: '{guildprefix}purge humans 50',
      handler: async (client, message, args) => {
        const number = validateNumber(args[0]);
        if (number === null) return runHelpCommand(message, 'purge');
        const messages = await fetchMessagesInBatches(message.channel, number, msg => !msg.author.bot);
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    media: {
      name: 'media',
      aliases: [],
      description: 'Delete messages with attachments or embeds',
      syntax: '{guildprefix}purge media [number]',
      parameters: ['number'],
      example: '{guildprefix}purge media 50',
      handler: async (client, message, args) => {
        const number = validateNumber(args[0]);
        if (number === null) return runHelpCommand(message, 'purge');
        const messages = await fetchMessagesInBatches(message.channel, number, msg => msg.attachments.size > 0 || msg.embeds.length > 0);
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    between: {
      name: 'between',
      aliases: [],
      description: 'Delete messages between two message IDs',
      syntax: '{guildprefix}purge between [topMsgID] [lastMsgID]',
      parameters: ['topMsgID', 'lastMsgID'],
      example: '{guildprefix}purge between 123456789 987654321',
      handler: async (client, message, args) => {
        if (!args[0] || !args[1]) return runHelpCommand(message, 'purge');
        try {
          const messages = await message.channel.messages.fetch({ after: args[1], before: args[0], limit: 100 });
          if (messages.size === 0) return;
          messages.set(message.id, message);
          await performBulkDelete(message, messages);
        } catch (error) {
          embeds.deny(message, 'Invalid message IDs provided or messages not found.');
        }
      }
    },

    after: {
      name: 'after',
      aliases: [],
      description: 'Delete messages after a message link',
      syntax: '{guildprefix}purge after [message link]',
      parameters: ['message link'],
      example: '{guildprefix}purge after https://discord.com/channels/...',
      handler: async (client, message, args) => {
        if (!args[0]) return runHelpCommand(message, 'purge');
        const messageLinkRegex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
        const match = args[0].match(messageLinkRegex);
        if (!match) return embeds.deny(message, 'Invalid message link provided');
        const [, guildId, channelId, messageId] = match;
        if (guildId !== message.guild.id || channelId !== message.channel.id) {
          return embeds.deny(message, 'Message link must be from this channel');
        }
        try {
          const messages = await message.channel.messages.fetch({ after: messageId, limit: 100 });
          messages.set(message.id, message);
          await performBulkDelete(message, messages);
        } catch (error) {
          embeds.deny(message, 'Failed to fetch messages after the provided link');
        }
      }
    },

    before: {
      name: 'before',
      aliases: [],
      description: 'Delete messages before a message link',
      syntax: '{guildprefix}purge before [message link]',
      parameters: ['message link'],
      example: '{guildprefix}purge before https://discord.com/channels/...',
      handler: async (client, message, args) => {
        if (!args[0]) return runHelpCommand(message, 'purge');
        const messageLinkRegex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
        const match = args[0].match(messageLinkRegex);
        if (!match) return embeds.deny(message, 'Invalid message link provided');
        const [, guildId, channelId, messageId] = match;
        if (guildId !== message.guild.id || channelId !== message.channel.id) {
          return embeds.deny(message, 'Message link must be from this channel');
        }
        try {
          const messages = await message.channel.messages.fetch({ before: messageId, limit: 100 });
          messages.set(message.id, message);
          await performBulkDelete(message, messages);
        } catch (error) {
          embeds.deny(message, 'Failed to fetch messages before the provided link');
        }
      }
    },

    webhooks: {
      name: 'webhooks',
      aliases: [],
      description: 'Delete messages from webhooks',
      syntax: '{guildprefix}purge webhooks [amount]',
      parameters: ['amount'],
      example: '{guildprefix}purge webhooks 50',
      handler: async (client, message, args) => {
        const number = validateNumber(args[0]);
        if (number === null) return runHelpCommand(message, 'purge');
        const messages = await fetchMessagesInBatches(message.channel, number, msg => msg.webhookId !== null);
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    links: {
      name: 'links',
      aliases: [],
      description: 'Delete messages containing links',
      syntax: '{guildprefix}purge links [amount]',
      parameters: ['amount'],
      example: '{guildprefix}purge links 50',
      handler: async (client, message, args) => {
        const number = validateNumber(args[0]);
        if (number === null) return runHelpCommand(message, 'purge');
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const messages = await fetchMessagesInBatches(message.channel, number, msg => urlRegex.test(msg.content));
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    startswith: {
      name: 'startswith',
      aliases: [],
      description: 'Delete messages starting with a substring',
      syntax: '{guildprefix}purge startswith [substring] [search]',
      parameters: ['substring', 'search'],
      example: '{guildprefix}purge startswith hello 100',
      handler: async (client, message, args) => {
        if (!args[0] || !args[1]) return runHelpCommand(message, 'purge');
        const substring = args[0].toLowerCase();
        const number = validateNumber(args[1]);
        if (number === null) return runHelpCommand(message, 'purge');
        const messages = await fetchMessagesInBatches(message.channel, number, msg => msg.content.toLowerCase().startsWith(substring));
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    endswith: {
      name: 'endswith',
      aliases: [],
      description: 'Delete messages ending with a substring',
      syntax: '{guildprefix}purge endswith [substring] [search]',
      parameters: ['substring', 'search'],
      example: '{guildprefix}purge endswith hello 100',
      handler: async (client, message, args) => {
        if (!args[0] || !args[1]) return runHelpCommand(message, 'purge');
        const substring = args[0].toLowerCase();
        const number = validateNumber(args[1]);
        if (number === null) return runHelpCommand(message, 'purge');
        const messages = await fetchMessagesInBatches(message.channel, number, msg => msg.content.toLowerCase().endsWith(substring));
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    contains: {
      name: 'contains',
      aliases: [],
      description: 'Delete messages containing a substring',
      syntax: '{guildprefix}purge contains [substring] [search]',
      parameters: ['substring', 'search'],
      example: '{guildprefix}purge contains hello 100',
      handler: async (client, message, args) => {
        if (!args[0] || !args[1]) return runHelpCommand(message, 'purge');
        const substring = args[0].toLowerCase();
        const number = validateNumber(args[1]);
        if (number === null) return runHelpCommand(message, 'purge');
        const messages = await fetchMessagesInBatches(message.channel, number, msg => msg.content.toLowerCase().includes(substring));
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    reactions: {
      name: 'reactions',
      aliases: [],
      description: 'Delete messages with reactions',
      syntax: '{guildprefix}purge reactions [amount]',
      parameters: ['amount'],
      example: '{guildprefix}purge reactions 50',
      handler: async (client, message, args) => {
        const number = validateNumber(args[0]);
        if (number === null) return runHelpCommand(message, 'purge');
        const messages = await fetchMessagesInBatches(message.channel, number, msg => msg.reactions.cache.size > 0);
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    stickers: {
      name: 'stickers',
      aliases: [],
      description: 'Delete messages with stickers',
      syntax: '{guildprefix}purge stickers [amount]',
      parameters: ['amount'],
      example: '{guildprefix}purge stickers 50',
      handler: async (client, message, args) => {
        const number = validateNumber(args[0]);
        if (number === null) return runHelpCommand(message, 'purge');
        const messages = await fetchMessagesInBatches(message.channel, number, msg => msg.stickers.size > 0);
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    emoji: {
      name: 'emoji',
      aliases: ['emote'],
      description: 'Delete messages containing emojis',
      syntax: '{guildprefix}purge emoji [amount]',
      parameters: ['amount'],
      example: '{guildprefix}purge emoji 50',
      handler: async (client, message, args) => {
        const number = validateNumber(args[0]);
        if (number === null) return runHelpCommand(message, 'purge');
        const emojiRegex = /<a?:\w+:\d+>|[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu;
        const messages = await fetchMessagesInBatches(message.channel, number, msg => emojiRegex.test(msg.content));
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    mentions: {
      name: 'mentions',
      aliases: [],
      description: 'Delete messages mentioning a specific member',
      syntax: '{guildprefix}purge mentions [member] [search]',
      parameters: ['member', 'search'],
      example: '{guildprefix}purge mentions @user 100',
      handler: async (client, message, args) => {
        let targetUserId;
        let numberArg;

        if (message.mentions.users.size > 0) {
          targetUserId = message.mentions.users.first().id;
          numberArg = args[1];
        } else {
          if (!args[0] || !args[1]) return runHelpCommand(message, 'purge');
          const { findUser } = require('../../../handlers/finder');
          const userResult = await findUser(message.guild, args[0], client);
          if (!userResult.found) return embeds.deny(message, userResult.error);
          if (userResult.isGlobal) return embeds.deny(message, `I was unable to find a **user** in this server with the name: **${args[0]}**`);
          targetUserId = userResult.user.user.id;
          numberArg = args[1];
        }

        const number = validateNumber(numberArg);
        if (number === null) return runHelpCommand(message, 'purge');
        const messages = await fetchMessagesInBatches(message.channel, number, msg => msg.mentions.users.has(targetUserId));
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    embeds: {
      name: 'embeds',
      aliases: [],
      description: 'Delete messages with embeds',
      syntax: '{guildprefix}purge embeds [amount]',
      parameters: ['amount'],
      example: '{guildprefix}purge embeds 50',
      handler: async (client, message, args) => {
        const number = validateNumber(args[0]);
        if (number === null) return runHelpCommand(message, 'purge');
        const messages = await fetchMessagesInBatches(message.channel, number, msg => msg.embeds.length > 0);
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    files: {
      name: 'files',
      aliases: [],
      description: 'Delete messages with file attachments (excluding images)',
      syntax: '{guildprefix}purge files [amount]',
      parameters: ['amount'],
      example: '{guildprefix}purge files 50',
      handler: async (client, message, args) => {
        const number = validateNumber(args[0]);
        if (number === null) return runHelpCommand(message, 'purge');
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
        const messages = await fetchMessagesInBatches(message.channel, number, msg => {
          if (msg.attachments.size === 0) return false;
          return msg.attachments.some(att => !imageExtensions.some(ext => att.name.toLowerCase().endsWith(ext)));
        });
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    },

    images: {
      name: 'images',
      aliases: [],
      description: 'Delete messages with image attachments',
      syntax: '{guildprefix}purge images [amount]',
      parameters: ['amount'],
      example: '{guildprefix}purge images 50',
      handler: async (client, message, args) => {
        const number = validateNumber(args[0]);
        if (number === null) return runHelpCommand(message, 'purge');
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
        const messages = await fetchMessagesInBatches(message.channel, number, msg => {
          return msg.attachments.some(att => imageExtensions.some(ext => att.name.toLowerCase().endsWith(ext)));
        });
        messages.set(message.id, message);
        await performBulkDelete(message, messages);
      }
    }
  },

  run: async (client, message, args) => {
    try {
      if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return embeds.deny(message, 'I need **Manage Messages** permission to use this command');
      }

      if (!args[0]) {
        return runHelpCommand(message, 'purge');
      }

      const sub = args[0].toLowerCase();

      // Find matching subcommand
      const subcommand = Object.values(module.exports.subcommands)
        .find(s => s.name === sub || s.aliases.includes(sub));

      if (subcommand) {
        return subcommand.handler(client, message, args.slice(1));
      }

      // Handle user mention purge
      if (message.mentions.users.size > 0) {
        const targetUser = message.mentions.users.first();
        const numberArg = args[1];
        const number = validateNumber(numberArg);
        if (number === null) return runHelpCommand(message, 'purge');
        const messages = await fetchMessagesInBatches(message.channel, number, msg => msg.author.id === targetUser.id);
        messages.set(message.id, message);
        return await performBulkDelete(message, messages);
      }

      // Default purge - just delete X number of messages
      const number = validateNumber(args[0]);
      if (number === null) {
        return runHelpCommand(message, 'purge');
      }

      const messages = await fetchMessagesInBatches(message.channel, number + 1);
      await performBulkDelete(message, messages);
    } catch (error) {
      throw error;
    }
  }
};
