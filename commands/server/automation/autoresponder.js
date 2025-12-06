const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureGuildData } = require('../../../database');
const { createPagination, createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');

module.exports = {
  name: "autoresponder",
  aliases: ['autoresponse', 'autorespond', 'trigger'],
  description: `automatically respond to specific triggers`,
  syntax: 'autoresponder [subcommand] (parameters)',
  example: 'autoresponder add hello, Hi there! --reply',
  permission: 'manage_channels',
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: ['create'],
      description: 'Add a new autoresponder trigger',
      syntax: '{guildprefix}autoresponder add [trigger], [response] [--options]',
      parameters: ['trigger', 'response', 'options (--reply, --strict, --not_strict, --delete, --self_destruct, --ping)'],
      example: '{guildprefix}autoresponder add hello, Hi there! <@&role_id> --reply --ping',

      handler: async (client, message, args, guildService) => {
        const fullInput = args.join(' ');

        let commaIndex;
        if (fullInput.startsWith(',')) {
          commaIndex = fullInput.indexOf(',', 1);
        } else {
          commaIndex = fullInput.indexOf(',');
        }

        if (commaIndex === -1) {
          return runHelpCommand(message, 'autoresponder');
        }

        const trigger = fullInput.substring(0, commaIndex).trim();
        const responseAndOptions = fullInput.substring(commaIndex + 1).trim();

        const optionRegex = /--(reply|strict|not_strict|delete|self_destruct|ping)\s*(\d+)?/g;
        let response = responseAndOptions;
        let options = { reply: false, strict: true, delete: false, selfDestruct: 0, pingEnabled: false };

        let match;
        while ((match = optionRegex.exec(responseAndOptions)) !== null) {
          response = response.replace(match[0], '').trim();
          switch (match[1]) {
            case 'reply': options.reply = true; break;
            case 'strict': options.strict = true; break;
            case 'not_strict': options.strict = false; break;
            case 'delete': options.delete = true; break;
            case 'self_destruct': options.selfDestruct = parseInt(match[2]) || 5; break;
            case 'ping': options.pingEnabled = true; break;
          }
        }

        if (!trigger || !response) {
          return runHelpCommand(message, 'autoresponder');
        }

        if (trigger.length > 50) {
          return embeds.deny(message, `Trigger word cannot be more than **50 letters**. Your trigger is **${trigger.length} letters**`);
        }

        if (trigger.startsWith(',')) {
          const commandName = trigger.substring(1);
          if (client.commands.has(commandName.toLowerCase()) || client.aliases.has(commandName.toLowerCase())) {
            return embeds.warn(message, `\`${commandName}\` is already a **bot command**, can't use this`);
          }
        }

        const existingResponder = await guildService.findAutoResponder(message.guild.id, trigger);
        if (existingResponder) {
          return embeds.deny(message, `An autoresponder for **${trigger}** already exists`);
        }

        const currentAutoResponders = await guildService.getAutoResponders(message.guild.id) || [];
        if (currentAutoResponders.length >= 50) {
          return embeds.deny(message, 'You have reached the **maximum autoresponders (50)**. Please remove some first.');
        }

        await guildService.addAutoResponder(message.guild.id, { trigger, response, ...options });

        let optionsDisplay = [];
        if (options.reply) optionsDisplay.push('reply');
        if (!options.strict) optionsDisplay.push('not_strict');
        if (options.delete) optionsDisplay.push('delete');
        if (options.selfDestruct > 0) optionsDisplay.push(`self_destruct ${options.selfDestruct}s`);
        if (options.pingEnabled) optionsDisplay.push('ping');

        const optionsText = optionsDisplay.length > 0 ? ` with options: ${optionsDisplay.join(', ')}` : '';
        return embeds.success(message, `Created autoresponder for **${trigger}**${optionsText}`);
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete', 'rm', 'del'],
      description: 'Remove an autoresponder',
      syntax: '{guildprefix}autoresponder remove [trigger]',
      parameters: ['trigger'],
      example: '{guildprefix}autoresponder remove hello',

      handler: async (client, message, args, guildService) => {
        const trigger = args.join(' ').trim();

        if (!trigger) {
          return runHelpCommand(message, 'autoresponder');
        }

        const data = await guildService.findAutoResponder(message.guild.id, trigger);

        if (data) {
          await guildService.removeAutoResponder(message.guild.id, trigger);
          return embeds.success(message, `Removed autoresponder for **${trigger}**`);
        } else {
          return embeds.deny(message, `No autoresponder found for **${trigger}**`);
        }
      }
    },

    update: {
      name: 'update',
      aliases: ['edit'],
      description: 'Update an existing autoresponder',
      syntax: '{guildprefix}autoresponder update [trigger], [new response] [--options]',
      parameters: ['trigger', 'new response', 'options (optional)'],
      example: '{guildprefix}autoresponder update hello, Hey there! --reply',

      handler: async (client, message, args, guildService) => {
        const fullInput = args.join(' ');

        let commaIndex;
        if (fullInput.startsWith(',')) {
          commaIndex = fullInput.indexOf(',', 1);
        } else {
          commaIndex = fullInput.indexOf(',');
        }

        if (commaIndex === -1) {
          return runHelpCommand(message, 'autoresponder');
        }

        const trigger = fullInput.substring(0, commaIndex).trim();
        const responseAndOptions = fullInput.substring(commaIndex + 1).trim();

        const optionRegex = /--(reply|strict|not_strict|delete|self_destruct|ping)\s*(\d+)?/g;
        let response = responseAndOptions;
        let options = { reply: false, strict: true, delete: false, selfDestruct: 0, pingEnabled: false };

        let match;
        while ((match = optionRegex.exec(responseAndOptions)) !== null) {
          response = response.replace(match[0], '').trim();
          switch (match[1]) {
            case 'reply': options.reply = true; break;
            case 'strict': options.strict = true; break;
            case 'not_strict': options.strict = false; break;
            case 'delete': options.delete = true; break;
            case 'self_destruct': options.selfDestruct = parseInt(match[2]) || 5; break;
            case 'ping': options.pingEnabled = true; break;
          }
        }

        if (!trigger || !response) {
          return runHelpCommand(message, 'autoresponder');
        }

        const existingResponder = await guildService.findAutoResponder(message.guild.id, trigger);
        if (!existingResponder) {
          return embeds.deny(message, `No autoresponder found for **${trigger}**`);
        }

        await guildService.updateAutoResponder(message.guild.id, trigger, { response, ...options });

        let optionsDisplay = [];
        if (options.reply) optionsDisplay.push('reply');
        if (!options.strict) optionsDisplay.push('not_strict');
        if (options.delete) optionsDisplay.push('delete');
        if (options.selfDestruct > 0) optionsDisplay.push(`self_destruct ${options.selfDestruct}s`);
        if (options.pingEnabled) optionsDisplay.push('ping');

        const optionsText = optionsDisplay.length > 0 ? ` with options: ${optionsDisplay.join(', ')}` : '';
        return embeds.success(message, `Updated autoresponder for **${trigger}**${optionsText}`);
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'List all autoresponders',
      syntax: '{guildprefix}autoresponder list',
      parameters: [],
      example: '{guildprefix}autoresponder list',

      handler: async (client, message, args, guildService) => {
        const data = await guildService.getAutoResponders(message.guild.id);

        if (data && data.length > 0) {
          const formatPage = (pageAutoresponders, currentPage, totalPages) => {
            const startIndex = (currentPage - 1) * 8;
            const autoresponderList = pageAutoresponders.map((autoresponder, index) => {
              const number = (startIndex + index + 1).toString().padStart(2, '0');
              const strictText = autoresponder.strict ? 'yes' : 'no';
              return `\`${number}\` ${autoresponder.trigger} (strict: ${strictText})`;
            }).join('\n');

            const entryText = data.length === 1 ? 'entry' : 'entries';
            return new EmbedBuilder()
              .setColor(config.colors.embed)
              .setTitle('Auto Responses')
              .setDescription(autoresponderList)
              .setFooter({ text: `${data.length} ${entryText} || page ${currentPage}/${totalPages}` });
          };

          await createPagination(message, data, formatPage, 8, 'Auto Responses');
        } else {
          return embeds.warn(message, 'No autoresponders found');
        }
      }
    },

    reset: {
      name: 'reset',
      aliases: [],
      description: 'Remove all autoresponders',
      syntax: '{guildprefix}autoresponder reset',
      parameters: [],
      example: '{guildprefix}autoresponder reset',

      handler: async (client, message, args, guildService) => {
        const data = await guildService.getAutoResponders(message.guild.id);

        if (data && data.length > 0) {
          await createConfirmation(
            message,
            'Are you sure you want to **remove all autoresponders**?',
            async (interaction) => {
              await guildService.clearAllAutoResponders(message.guild.id);

              const successEmbed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setDescription(`✅ <@${message.author.id}>: Removed all autoresponders`);

              await interaction.editReply({ embeds: [successEmbed], components: [] });
            }
          );
        } else {
          return embeds.warn(message, 'No autoresponders found');
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
      return runHelpCommand(message, 'autoresponder');
    }

    // Find matching subcommand
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'autoresponder');
  }
};
