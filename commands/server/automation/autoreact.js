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
  run: async(client, message, args) => {
    const guildService = getService('guild');

    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;

    // Ensure guild data exists in the database
    await ensureGuildData(message.guild.id);

    if (args[0] === 'add' || args[0] === 'create') {
      const subcommandInfo = {
        description: 'Add an autoreact for a word',
        syntax: '{guildprefix}autoreact add [emoji] [word]',
        aliases: ['create'],
        parameters: ['emoji', 'word'],
        example: '{guildprefix}autoreact add :star: hello'
      };

      if (!args[1] || !args[2]) {
        return runHelpCommand(message, 'autoreact');
      }

      const emojiInput = args[1];
      const word = args[2].toLowerCase();

      // Check word length
      if (word.length < 3) {
        return embeds.warn(message, 'Trigger word must contain **more than 2 characters**');
      }

      let emojiId = null;
      let emojiName = null;
      let isCustom = false;

      // Check if it's a custom emoji format <:name:id> or <a:name:id>
      const customEmojiMatch = emojiInput.match(/^<a?:(\w+):(\d+)>$/);

      if (customEmojiMatch) {
        emojiName = customEmojiMatch[1];
        emojiId = customEmojiMatch[2];

        // Check if the emoji exists in the guild
        const emoji = message.guild.emojis.cache.get(emojiId);

        if (!emoji) {
          return embeds.warn(message, '**Wrong emote** - emoji not found in this server');
        }

        isCustom = true;
      } else {
        // For unicode emojis
        emojiName = emojiInput;
        isCustom = false;
      }

      // Check if trigger already exists using cache system
      const autoReacts = await guildService.getAutoReacts(message.guild.id);
      const existingData = autoReacts.find(ar => ar.word === word);

      if (existingData) {
        return embeds.warn(message, `Reaction trigger already exists for **${word}**`);
      }

      // Check autoreact limit (50 max)
      if (autoReacts.length >= 50) {
        return embeds.deny(message, 'You have reached the **maximum autoreacts (50)**. Please remove some first.');
      }

      // Save using cache system
      await guildService.addAutoReact(message.guild.id, word, emojiId, emojiName, isCustom);

      const emojiDisplay = isCustom ? `<:${emojiName}:${emojiId}>` : emojiName;
      return embeds.success(message, `Created autoreact for **${word}** with ${emojiDisplay}`);

    } else if (args[0] === 'remove' || args[0] === 'delete' || args[0] === 'rm' || args[0] === 'del') {
      const subcommandInfo = {
        description: 'Remove an autoreact for a word',
        syntax: '{guildprefix}autoreact remove [word]',
        aliases: ['delete', 'rm', 'del'],
        parameters: ['word'],
        example: '{guildprefix}autoreact remove hello'
      };

      const word = args[1];

      if (!word) {
        return runHelpCommand(message, 'autoreact');
      }

      // Check if autoreact exists using cache system
      const autoReacts = await guildService.getAutoReacts(message.guild.id);
      const data = autoReacts.find(ar => ar.word === word.toLowerCase());

      if (data) {
        await guildService.removeAutoReact(message.guild.id, word.toLowerCase());
        return embeds.success(message, `Removed autoreact for **${word}**`);
      } else {
        return embeds.warn(message, `No autoreact found for **${word}**`);
      }

    } else if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'List all autoreacts',
        syntax: '{guildprefix}autoreact list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}autoreact list'
      };

      const data = await guildService.getAutoReacts(message.guild.id);

      if (data && data.length > 0) {
        // Clean up invalid emojis before displaying
        const validData = [];
        for (const autoreact of data) {
          if (autoreact.isCustom) {
            // Check if custom emoji still exists in the guild
            const emoji = message.guild.emojis.cache.get(autoreact.emojiId);
            if (emoji) {
              validData.push(autoreact);
            } else {
              // Remove invalid emoji using cache system
              await guildService.removeAutoReact(message.guild.id, autoreact.word);
            }
          } else {
            // Unicode emojis are always valid
            validData.push(autoreact);
          }
        }

        if (validData.length === 0) {
          return embeds.warn(message, 'No autoreacts found');
        }

        // Format page function for pagination
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

        // Use pagination system with 10 items per page
        await createPagination(message, validData, formatPage, 10, 'Autoreacts');
      } else {
        return embeds.warn(message, 'No autoreacts found');
      }

    } else if (args[0] === 'reset') {
      const subcommandInfo = {
        description: 'Remove all autoreacts',
        syntax: '{guildprefix}autoreact reset',
        aliases: [],
        parameters: [],
        example: '{guildprefix}autoreact reset'
      };

      const data = await guildService.getAutoReacts(message.guild.id);

      if (data && data.length > 0) {
        // Show confirmation dialog
        await createConfirmation(
          message,
          'Are you sure you want to **remove all autoreacts**?',
          async (interaction) => {
            // On approve: delete all autoreacts using cache system
            await guildService.clearAllAutoReacts(message.guild.id);

            // Edit the confirmation embed to show success message
            const successEmbed = new EmbedBuilder()
              .setColor(config.colors.success)
              .setDescription(`✅ <@${message.author.id}>: Removed all autoreacts`);

            await interaction.editReply({ embeds: [successEmbed], components: [] });
          }
        );
      } else {
        return embeds.warn(message, 'No autoreacts found');
      }

    } else {
      return runHelpCommand(message, 'autoreact');
    }
  }
}
