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
  run: async(client, message, args) => {
    const guildService = getService('guild');

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;

    // Ensure guild data exists in the database
    await ensureGuildData(message.guild.id);

    if (args[0] === 'add' || args[0] === 'create') {
      const subcommandInfo = {
        description: 'Add a new autoresponder trigger',
        usage: '{guildprefix}autoresponder add [trigger], [response] [--options]',
        aliases: ['create'],
        parameters: ['trigger', 'response', 'options (optional)'],
        example: '{guildprefix}autoresponder add hello, Hi there! --reply'
      };

      const fullInput = args.slice(1).join(' ');

      // Handle cases where trigger starts with comma
      let commaIndex;
      if (fullInput.startsWith(',')) {
        // If input starts with comma, find the second comma
        commaIndex = fullInput.indexOf(',', 1);
      } else {
        // Normal case: find first comma
        commaIndex = fullInput.indexOf(',');
      }

      if (commaIndex === -1) {
        return runHelpCommand(message, 'autoresponder');
      }

      const trigger = fullInput.substring(0, commaIndex).trim();
      const responseAndOptions = fullInput.substring(commaIndex + 1).trim();

      // Parse options from the response
      const optionRegex = /--(reply|strict|not_strict|delete|self_destruct)\s*(\d+)?/g;
      let response = responseAndOptions;
      let options = {
        reply: false,
        strict: true,
        delete: false,
        selfDestruct: 0
      };

      let match;
      while ((match = optionRegex.exec(responseAndOptions)) !== null) {
        const option = match[1];
        const value = match[2];

        // Remove the option from response
        response = response.replace(match[0], '').trim();

        switch (option) {
          case 'reply':
            options.reply = true;
            break;
          case 'strict':
            options.strict = true;
            break;
          case 'not_strict':
            options.strict = false;
            break;
          case 'delete':
            options.delete = true;
            break;
          case 'self_destruct':
            options.selfDestruct = parseInt(value) || 5;
            break;
        }
      }

      if (!trigger || !response) {
        return runHelpCommand(message, 'autoresponder');
      }

      // Check trigger length limit
      if (trigger.length > 12) {
        return embeds.deny(message, `Trigger word cannot be more than **12 letters**. Your trigger is **${trigger.length} letters**`);
      }

      if (trigger.startsWith(',')) {
        const commandName = trigger.substring(1); // Remove the comma
        const isCommand = client.commands.has(commandName.toLowerCase());
        const isAlias = client.aliases.has(commandName.toLowerCase());

        if (isCommand || isAlias) {
          return embeds.warn(message, `\`${commandName}\` is already a **bot command**, can't use this`);
        }
      }

      // Check if autoresponder already exists using cache system
      const existingResponder = await guildService.findAutoResponder(message.guild.id, trigger);

      if (existingResponder) {
        return embeds.deny(message, `An autoresponder for **${trigger}** already exists`);
      }

      // Check autoresponder limit (50 max)
      const currentAutoResponders = await guildService.getAutoResponders(message.guild.id) || [];
      if (currentAutoResponders.length >= 50) {
        return embeds.deny(message, 'You have reached the **maximum autoresponders (50)**. Please remove some first.');
      }

      // Save using cache system
      await guildService.addAutoResponder(message.guild.id, {
        trigger,
        response,
        ...options
      });

      // Build options display
      let optionsDisplay = [];
      if (options.reply) optionsDisplay.push('reply');
      if (!options.strict) optionsDisplay.push('not_strict');
      if (options.delete) optionsDisplay.push('delete');
      if (options.selfDestruct > 0) optionsDisplay.push(`self_destruct ${options.selfDestruct}s`);

      const optionsText = optionsDisplay.length > 0 ? ` with options: ${optionsDisplay.join(', ')}` : '';
      return embeds.success(message, `Created autoresponder for **${trigger}**${optionsText}`);


      
    } else if (args[0] === 'reset') {
      const subcommandInfo = {
        description: 'Remove all autoresponders',
        usage: '{guildprefix}autoresponder reset',
        aliases: [],
        parameters: [],
        example: '{guildprefix}autoresponder reset'
      };

      const data = await guildService.getAutoResponders(message.guild.id);

      if (data && data.length > 0) {
        // Show confirmation dialog
        await createConfirmation(
          message,
          'Are you sure you want to **remove all autoresponders**?',
          async (interaction) => {
            // On approve: delete all autoresponders using cache system
            await guildService.clearAllAutoResponders(message.guild.id);

            // Edit the confirmation embed to show success message
            const successEmbed = new EmbedBuilder()
              .setColor(config.colors.success)
              .setDescription(`✅ <@${message.author.id}>: Removed all autoresponders`);

            await interaction.editReply({ embeds: [successEmbed], components: [] });
          }
        );
      } else {
        return embeds.warn(message, 'No autoresponders found');
      }



    } else if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'List all autoresponders',
        usage: '{guildprefix}autoresponder list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}autoresponder list'
      };

      const data = await guildService.getAutoResponders(message.guild.id);

      if (data && data.length > 0) {
        // Format page function for pagination
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

        // Use pagination system with 8 items per page
        await createPagination(message, data, formatPage, 8, 'Auto Responses');
      } else {
        return embeds.warn(message, 'No autoresponders found');
      }



    } else if (args[0] === 'remove' || args[0] === 'delete' || args[0] === 'rm' || args[0] === 'del') {
      const subcommandInfo = {
        description: 'Remove an autoresponder',
        usage: '{guildprefix}autoresponder remove [trigger]',
        aliases: ['delete', 'rm', 'del'],
        parameters: ['trigger'],
        example: '{guildprefix}autoresponder remove hello'
      };

      const trigger = args[1];

      if (!trigger) {
        return runHelpCommand(message, 'autoresponder');
      }

      // Check if autoresponder exists using cache system
      const data = await guildService.findAutoResponder(message.guild.id, trigger);

      if (data) {
        await guildService.removeAutoResponder(message.guild.id, trigger);
        return embeds.success(message, `Removed autoresponder for **${trigger}**`);
      } else {
        return embeds.deny(message, `No autoresponder found for **${trigger}**`);
      }

    } else {
      return runHelpCommand(message, 'autoresponder');
    }
  }
}