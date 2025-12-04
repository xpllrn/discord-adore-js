const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureGuildData } = require('../../../database');
const { createPagination, createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');

module.exports = {
  name: "tag",
  aliases: ['tags', 't'],
  description: `create custom tag triggers with responses`,
  syntax: 'tag [subcommand] (parameters)',
  example: 'tag add hello, Hey there! How are you?',
  permission: 'manage_messages',
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: ['create'],
      description: 'Add a new tag',
      syntax: '{guildprefix}tag add [trigger], [response]',
      parameters: ['trigger (one word)', 'response'],
      example: '{guildprefix}tag add hello, Hey there! How are you?',

      handler: async (client, message, args, guildService) => {
        const fullInput = args.join(' ');
        const commaIndex = fullInput.indexOf(',');

        if (commaIndex === -1) {
          return runHelpCommand(message, 'tag');
        }

        const trigger = fullInput.substring(0, commaIndex).trim().toLowerCase();
        const response = fullInput.substring(commaIndex + 1).trim();

        if (!trigger || !response) {
          return runHelpCommand(message, 'tag');
        }

        // Trigger must be one word
        if (trigger.includes(' ')) {
          return embeds.deny(message, 'Tag trigger must be **one word** only');
        }

        if (trigger.length > 50) {
          return embeds.deny(message, `Trigger cannot be more than **50 characters**. Yours is **${trigger.length}**`);
        }

        if (response.length > 2000) {
          return embeds.deny(message, `Response cannot be more than **2000 characters**. Yours is **${response.length}**`);
        }

        // Check if trigger is a bot command
        if (client.commands.has(trigger) || client.aliases.has(trigger)) {
          return embeds.warn(message, `\`${trigger}\` is already a **bot command**, can't use this`);
        }

        const existingTag = await guildService.findTag(message.guild.id, trigger);
        if (existingTag) {
          return embeds.deny(message, `A tag for **${trigger}** already exists`);
        }

        await guildService.addTag(message.guild.id, {
          trigger,
          response,
          authorId: message.author.id
        });

        return embeds.success(message, `Created tag **${trigger}**`);
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete', 'rm', 'del'],
      description: 'Remove a tag',
      syntax: '{guildprefix}tag remove [trigger]',
      parameters: ['trigger'],
      example: '{guildprefix}tag remove hello',

      handler: async (client, message, args, guildService) => {
        const trigger = args.join(' ').trim().toLowerCase();

        if (!trigger) {
          return runHelpCommand(message, 'tag');
        }

        const tag = await guildService.findTag(message.guild.id, trigger);

        if (tag) {
          await guildService.removeTag(message.guild.id, trigger);
          return embeds.success(message, `Removed tag **${trigger}**`);
        } else {
          return embeds.deny(message, `No **tag** were found for **${trigger}**`);
        }
      }
    },

    edit: {
      name: 'edit',
      aliases: ['update'],
      description: 'Edit a tag response',
      syntax: '{guildprefix}tag edit [trigger], [new response]',
      parameters: ['trigger', 'new response'],
      example: '{guildprefix}tag edit hello, Hey! What\'s up?',

      handler: async (client, message, args, guildService) => {
        const fullInput = args.join(' ');
        const commaIndex = fullInput.indexOf(',');

        if (commaIndex === -1) {
          return runHelpCommand(message, 'tag');
        }

        const trigger = fullInput.substring(0, commaIndex).trim().toLowerCase();
        const newResponse = fullInput.substring(commaIndex + 1).trim();

        if (!trigger || !newResponse) {
          return runHelpCommand(message, 'tag');
        }

        if (newResponse.length > 2000) {
          return embeds.deny(message, `Response cannot be more than **2000 characters**. Yours is **${newResponse.length}**`);
        }

        const existingTag = await guildService.findTag(message.guild.id, trigger);
        if (!existingTag) {
          return embeds.deny(message, `No **tag** found for **${trigger}**`);
        }

        const success = await guildService.updateTagResponse(message.guild.id, trigger, newResponse);
        if (success) {
          return embeds.success(message, `Updated tag **${trigger}**`);
        } else {
          return embeds.deny(message, `Failed to update tag **${trigger}**`);
        }
      }
    },

    rename: {
      name: 'rename',
      aliases: [],
      description: 'Rename a tag trigger',
      syntax: '{guildprefix}tag rename [old trigger] [new trigger]',
      parameters: ['old trigger', 'new trigger'],
      example: '{guildprefix}tag rename hello hi',

      handler: async (client, message, args, guildService) => {
        if (args.length < 2) {
          return runHelpCommand(message, 'tag');
        }

        const oldTrigger = args[0].toLowerCase();
        const newTrigger = args[1].toLowerCase();

        if (newTrigger.includes(' ')) {
          return embeds.deny(message, 'New trigger must be **one word** only');
        }

        if (newTrigger.length > 50) {
          return embeds.deny(message, `New trigger cannot be more than **50 characters**`);
        }

        // Check if new trigger is a bot command
        if (client.commands.has(newTrigger) || client.aliases.has(newTrigger)) {
          return embeds.warn(message, `\`${newTrigger}\` is already a **bot command**, can't use this`);
        }

        const existingTag = await guildService.findTag(message.guild.id, oldTrigger);
        if (!existingTag) {
          return embeds.deny(message, `No **tag** found for **${oldTrigger}**`);
        }

        const success = await guildService.renameTag(message.guild.id, oldTrigger, newTrigger);
        if (success) {
          return embeds.success(message, `Renamed tag **${oldTrigger}** to **${newTrigger}**`);
        } else {
          return embeds.deny(message, `A tag for **${newTrigger}** already exists`);
        }
      }
    },

    info: {
      name: 'info',
      aliases: ['view', 'show'],
      description: 'View a specific tag',
      syntax: '{guildprefix}tag info [trigger]',
      parameters: ['trigger'],
      example: '{guildprefix}tag info hello',

      handler: async (client, message, args, guildService) => {
        const trigger = args.join(' ').trim().toLowerCase();

        if (!trigger) {
          return runHelpCommand(message, 'tag');
        }

        const tag = await guildService.findTag(message.guild.id, trigger);

        if (!tag) {
          return embeds.deny(message, `No tag found for **${trigger}**`);
        }

        let authorName = 'Unknown';
        try {
          const author = await client.users.fetch(tag.authorId);
          authorName = author.tag;
        } catch (e) {
          // User not found
        }

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle(`Tag: ${tag.trigger}`)
          .addFields(
            { name: 'Response', value: tag.response.length > 1024 ? tag.response.substring(0, 1021) + '...' : tag.response },
            { name: 'Author', value: authorName, inline: true },
            { name: 'Uses', value: `${tag.uses || 0}`, inline: true },
            { name: 'Created', value: tag.createdAt ? `<t:${Math.floor(new Date(tag.createdAt).getTime() / 1000)}:R>` : 'Unknown', inline: true }
          );

        return message.channel.send({ embeds: [embed] });
      }
    },

    list: {
      name: 'list',
      aliases: ['all'],
      description: 'List all tags or tags by a user',
      syntax: '{guildprefix}tag list (user)',
      parameters: ['user (optional)'],
      example: '{guildprefix}tag list @user',

      handler: async (client, message, args, guildService) => {
        let tags;
        let title = 'Server Tags';

        // Check if user is mentioned or ID provided
        const userArg = args[0];
        if (userArg) {
          const userId = userArg.replace(/[<@!>]/g, '');
          tags = await guildService.getTagsByAuthor(message.guild.id, userId);
          
          try {
            const user = await client.users.fetch(userId);
            title = `Tags by ${user.username}`;
          } catch (e) {
            title = `Tags by User`;
          }
        } else {
          tags = await guildService.getTags(message.guild.id);
        }

        if (!tags || tags.length === 0) {
          return embeds.warn(message, userArg ? 'No tags found for this user' : 'No tags found');
        }

        const formatPage = (pageTags, currentPage, totalPages) => {
          const startIndex = (currentPage - 1) * 10;
          const tagList = pageTags.map((tag, index) => {
            const number = (startIndex + index + 1).toString().padStart(2, '0');
            return `\`${number}\` **${tag.trigger}** - ${tag.uses || 0} uses`;
          }).join('\n');

          const entryText = tags.length === 1 ? 'tag' : 'tags';
          return new EmbedBuilder()
            .setColor(config.colors.embed)
            .setTitle(title)
            .setDescription(tagList)
            .setFooter({ text: `${tags.length} ${entryText} || page ${currentPage}/${totalPages}` });
        };

        await createPagination(message, tags, formatPage, 10, title);
      }
    },

    random: {
      name: 'random',
      aliases: ['rand'],
      description: 'Get a random tag',
      syntax: '{guildprefix}tag random (user)',
      parameters: ['user (optional)'],
      example: '{guildprefix}tag random @user',

      handler: async (client, message, args, guildService) => {
        let authorId = null;

        // Check if user is mentioned or ID provided
        const userArg = args[0];
        if (userArg) {
          authorId = userArg.replace(/[<@!>]/g, '');
        }

        const tag = await guildService.getRandomTag(message.guild.id, authorId);

        if (!tag) {
          return embeds.warn(message, authorId ? 'No tags found for this user' : 'No tags found');
        }

        // Check if response contains embed syntax
        const trimmedResponse = tag.response.trim();
        if (trimmedResponse.startsWith('{embed}') || trimmedResponse.startsWith('{v2}') || trimmedResponse.startsWith('{container}')) {
          const { EmbedVariableProcessor } = require('../../../utils/embeds/embedbuilder');
          const variables = {
            user: message.author,
            guild: message.guild,
            channel: message.channel
          };
          await EmbedVariableProcessor.process(message.channel, tag.response, variables, message);
        } else {
          await message.channel.send(`**${tag.trigger}**: ${tag.response}`);
        }

        // Increment uses
        await guildService.incrementTagUses(message.guild.id, tag.trigger);
      }
    },

    reset: {
      name: 'reset',
      aliases: ['clear'],
      description: 'Remove all tags (requires Manage Guild)',
      syntax: '{guildprefix}tag reset',
      parameters: [],
      example: '{guildprefix}tag reset',

      handler: async (client, message, args, guildService) => {
        // Reset requires Manage Guild permission
        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) return;

        const tags = await guildService.getTags(message.guild.id);

        if (!tags || tags.length === 0) {
          return embeds.warn(message, 'No tags found');
        }

        await createConfirmation(
          message,
          `Are you sure you want to **remove all ${tags.length} tags**?`,
          async (interaction) => {
            await guildService.clearAllTags(message.guild.id);

            const successEmbed = new EmbedBuilder()
              .setColor(config.colors.success)
              .setDescription(`✅ <@${message.author.id}>: Removed all tags`);

            await interaction.editReply({ embeds: [successEmbed], components: [] });
          }
        );
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');

    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return;
    await ensureGuildData(message.guild.id);

    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return runHelpCommand(message, 'tag');
    }

    // Find matching subcommand
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    // If no subcommand matched, check if it's a tag trigger (for quick view)
    const tag = await guildService.findTag(message.guild.id, sub);
    if (tag) {
      // Show tag info
      return module.exports.subcommands.info.handler(client, message, [sub], guildService);
    }

    // No tag found for this trigger
    return embeds.warn(message, `No existing **tag** found for **${sub}**`);
  }
};
