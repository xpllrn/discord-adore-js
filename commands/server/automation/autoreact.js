const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureGuildData } = require('../../../database');
const { createPagination, createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');

module.exports = {
  name: "autoreact",
  aliases: ['react'],
  description: `automatically react to messages containing specific words`,
  syntax: 'autoreact [subcommand] (parameters)',
  example: 'autoreact add :star: hello',
  permission: 'manage_channels',
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: ['create'],
      description: 'Add an autoreact for a word',
      syntax: '{guildprefix}autoreact add [emoji] [word]',
      parameters: ['emoji', 'word'],
      example: '{guildprefix}autoreact add :star: hello',

      handler: async (client, message, args, guildService) => {
        if (!args[0] || !args[1]) {
          return runHelpCommand(message, 'autoreact');
        }

        const emojiInput = args[0];
        const word = args[1].toLowerCase();

        if (word.length < 3) {
          return embeds.warn(message, 'Trigger word must contain **more than 2 characters**');
        }

        let emojiId = null;
        let emojiName = null;
        let isCustom = false;

        const customEmojiMatch = emojiInput.match(/^<a?:(\w+):(\d+)>$/);

        if (customEmojiMatch) {
          emojiName = customEmojiMatch[1];
          emojiId = customEmojiMatch[2];
          const emoji = message.guild.emojis.cache.get(emojiId);
          if (!emoji) {
            return embeds.warn(message, '**Wrong emote** - emoji not found in this server');
          }
          isCustom = true;
        } else {
          emojiName = emojiInput;
          isCustom = false;
        }

        const autoReacts = await guildService.getAutoReacts(message.guild.id);
        const existingData = autoReacts.find(ar => ar.word === word);

        if (existingData) {
          return embeds.warn(message, `Reaction trigger already exists for **${word}**`);
        }

        if (autoReacts.length >= 50) {
          return embeds.deny(message, 'You have reached the **maximum autoreacts (50)**. Please remove some first.');
        }

        await guildService.addAutoReact(message.guild.id, word, emojiId, emojiName, isCustom);

        const emojiDisplay = isCustom ? `<:${emojiName}:${emojiId}>` : emojiName;
        return embeds.success(message, `Created autoreact for **${word}** with ${emojiDisplay}`);
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete', 'rm', 'del'],
      description: 'Remove an autoreact for a word',
      syntax: '{guildprefix}autoreact remove [word]',
      parameters: ['word'],
      example: '{guildprefix}autoreact remove hello',

      handler: async (client, message, args, guildService) => {
        const word = args[0];

        if (!word) {
          return runHelpCommand(message, 'autoreact');
        }

        const autoReacts = await guildService.getAutoReacts(message.guild.id);
        const data = autoReacts.find(ar => ar.word === word.toLowerCase());

        if (data) {
          await guildService.removeAutoReact(message.guild.id, word.toLowerCase());
          return embeds.success(message, `Removed autoreact for **${word}**`);
        } else {
          return embeds.warn(message, `No autoreact found for **${word}**`);
        }
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'List all autoreacts',
      syntax: '{guildprefix}autoreact list',
      parameters: [],
      example: '{guildprefix}autoreact list',

      handler: async (client, message, args, guildService) => {
        const data = await guildService.getAutoReacts(message.guild.id);

        if (data && data.length > 0) {
          const validData = [];
          for (const autoreact of data) {
            if (autoreact.isCustom) {
              const emoji = message.guild.emojis.cache.get(autoreact.emojiId);
              if (emoji) {
                validData.push(autoreact);
              } else {
                await guildService.removeAutoReact(message.guild.id, autoreact.word);
              }
            } else {
              validData.push(autoreact);
            }
          }

          if (validData.length === 0) {
            return embeds.warn(message, 'No autoreacts found');
          }

          const formatPage = (pageAutoreacts, currentPage, totalPages) => {
            const startIndex = (currentPage - 1) * 10;
            const autoreactList = pageAutoreacts.map((autoreact, index) => {
              const number = (startIndex + index + 1).toString().padStart(2, '0');
              const emojiDisplay = autoreact.isCustom ?
                `<:${autoreact.emojiName}:${autoreact.emojiId}>` :
                autoreact.emojiName;
              return `\`${number}\` **${autoreact.word}** → ${emojiDisplay}`;
            }).join('\n');

            return new EmbedBuilder()
              .setColor(config.colors.embed)
              .setTitle('Autoreacts')
              .setDescription(autoreactList)
              .setFooter({ text: `${validData.length} autoreacts • Page ${currentPage}/${totalPages}` });
          };

          await createPagination(message, validData, formatPage, 10, 'Autoreacts');
        } else {
          return embeds.warn(message, 'No autoreacts found');
        }
      }
    },

    reset: {
      name: 'reset',
      aliases: [],
      description: 'Remove all autoreacts',
      syntax: '{guildprefix}autoreact reset',
      parameters: [],
      example: '{guildprefix}autoreact reset',

      handler: async (client, message, args, guildService) => {
        const data = await guildService.getAutoReacts(message.guild.id);

        if (data && data.length > 0) {
          await createConfirmation(
            message,
            'Are you sure you want to **remove all autoreacts**?',
            async (interaction) => {
              await guildService.clearAllAutoReacts(message.guild.id);

              const successEmbed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setDescription(`✅ <@${message.author.id}>: Removed all autoreacts`);

              await interaction.editReply({ embeds: [successEmbed], components: [] });
            }
          );
        } else {
          return embeds.warn(message, 'No autoreacts found');
        }
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');

    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;
    await ensureGuildData(message.guild.id);

    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return runHelpCommand(message, 'autoreact');
    }

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'autoreact');
  }
};
