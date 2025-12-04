const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { getService } = require('@services');
const { colors } = require('../../../config/setup');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { createConfirmation } = require('../../../core/buttons');
const logger = require('../../../utils/logger');

module.exports = {
  name: "alias",
  aliases: [],
  description: 'Create your own shortcuts for commands',
  syntax: 'alias [subcommand] (parameters)',
  example: 'alias add bal balance',
  permission: 'manage_guild',
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: ['create'],
      description: 'Create an alias for a command with optional {0} placeholder',
      syntax: '{guildprefix}alias add [shortcut] [command]',
      parameters: ['shortcut', 'command'],
      example: '{guildprefix}alias add deport ban',

      handler: async (client, message, args, guildService) => {
        if (args.length < 2) {
          return embeds.warn(message, 'Please provide a shortcut and command: `alias add [shortcut] [command]`');
        }

        const shortcut = args[0].toLowerCase();
        const command = args.slice(1).join(' ');

        if (shortcut.length > 20) {
          return embeds.warn(message, 'Shortcut cannot be longer than **20 characters**');
        }

        if (shortcut.includes(' ')) {
          return embeds.warn(message, 'Shortcut cannot contain **spaces**');
        }

        const existingCommand = message.client.commands.get(shortcut) || 
                                message.client.commands.get(message.client.aliases.get(shortcut));
        
        if (existingCommand) {
          return embeds.warn(message, `\`${shortcut}\` conflicts with an **existing command**`);
        }

        const commandBase = command.split(' ')[0].toLowerCase();
        const targetCommand = message.client.commands.get(commandBase) ||
                             message.client.commands.get(message.client.aliases.get(commandBase));
        
        if (!targetCommand) {
          return embeds.warn(message, `\`${commandBase}\` is not an **existing command**`);
        }

        try {
          const guildData = await guildService.ensureGuildData(message.guild.id);
          const aliases = guildData.Aliases || [];

          if (aliases.length >= 50) {
            return embeds.warn(message, 'This server has reached the **maximum of 50 aliases**');
          }

          const existingAlias = aliases.find(a => a.shortcut === shortcut);
          
          if (existingAlias) {
            existingAlias.command = command;
            existingAlias.createdBy = message.author.id;
            existingAlias.createdAt = new Date();
            await guildService.set(message.guild.id, guildData);
            return embeds.success(message, `Updated **${shortcut}** for command \`${command}\``);
          } else {
            aliases.push({ shortcut, command, createdBy: message.author.id, createdAt: new Date() });
            guildData.Aliases = aliases;
            await guildService.set(message.guild.id, guildData);
            return embeds.success(message, `Added **${shortcut}** for command \`${command}\``);
          }
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to **create alias**');
        }
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete'],
      description: 'Remove an alias',
      syntax: '{guildprefix}alias remove [shortcut]',
      parameters: ['shortcut'],
      example: '{guildprefix}alias remove bal',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) {
          return embeds.warn(message, 'Please provide a shortcut to remove: `alias remove [shortcut]`');
        }

        const shortcut = args[0].toLowerCase();

        try {
          const guildData = await guildService.ensureGuildData(message.guild.id);
          const aliases = guildData.Aliases || [];
          const aliasIndex = aliases.findIndex(a => a.shortcut === shortcut);
          
          if (aliasIndex === -1) {
            return embeds.warn(message, `\`${shortcut}\` is not an existing **alias**`);
          }

          aliases.splice(aliasIndex, 1);
          guildData.Aliases = aliases;
          await guildService.set(message.guild.id, guildData);
          
          return embeds.success(message, `Removed **alias** \`${shortcut}\``);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to **remove alias**');
        }
      }
    },

    removeall: {
      name: 'removeall',
      aliases: ['clear'],
      description: 'Remove all aliases in this server',
      syntax: '{guildprefix}alias removeall',
      parameters: [],
      example: '{guildprefix}alias removeall',

      handler: async (client, message, args, guildService) => {
        try {
          const guildData = await guildService.ensureGuildData(message.guild.id);
          const aliases = guildData.Aliases || [];

          if (aliases.length === 0) {
            return embeds.warn(message, 'No **aliases** found for **any commands**');
          }

          guildData.Aliases = [];
          await guildService.set(message.guild.id, guildData);
          
          return embeds.success(message, `Cleared **all aliases** for **commands**`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to **remove aliases**');
        }
      }
    },

    list: {
      name: 'list',
      aliases: ['view'],
      description: 'List all your aliases',
      syntax: '{guildprefix}alias list',
      parameters: [],
      example: '{guildprefix}alias list',

      handler: async (client, message, args, guildService) => {
        try {
          const guildData = await guildService.ensureGuildData(message.guild.id);
          const aliases = guildData.Aliases || [];

          if (aliases.length === 0) {
            return embeds.warn(message, 'No **aliases** found for **any commands**');
          }

          const embed = new EmbedBuilder()
            .setColor(colors.embed)
            .setTitle(`${message.guild.name}'s Aliases`)
            .setDescription(`This server has **${aliases.length}** alias${aliases.length === 1 ? '' : 'es'}`)
            .setFooter({ text: `Use "alias remove [shortcut]" to remove an alias` });

          const sortedAliases = aliases.sort((a, b) => a.shortcut.localeCompare(b.shortcut));
          let currentField = '';
          let fieldCount = 0;

          for (const alias of sortedAliases) {
            const creator = alias.createdBy ? `<@${alias.createdBy}>` : 'Unknown';
            const line = `\`${alias.shortcut}\` → \`${alias.command}\` (by ${creator})\n`;
            
            if (currentField.length + line.length > 1024 || fieldCount >= 25) {
              if (currentField) {
                embed.addFields({ name: '\u200b', value: currentField, inline: false });
                currentField = '';
                fieldCount++;
              }
            }
            currentField += line;
          }

          if (currentField) {
            embed.addFields({ name: '\u200b', value: currentField, inline: false });
          }

          return message.channel.send({ embeds: [embed] });
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to **list aliases**');
        }
      }
    },

    reset: {
      name: 'reset',
      aliases: [],
      description: 'Reset all your aliases with confirmation',
      syntax: '{guildprefix}alias reset',
      parameters: [],
      example: '{guildprefix}alias reset',

      handler: async (client, message, args, guildService) => {
        try {
          const guildData = await guildService.ensureGuildData(message.guild.id);
          const aliases = guildData.Aliases || [];

          if (aliases.length === 0) {
            return embeds.warn(message, 'No **aliases** found for **any commands**');
          }

          await createConfirmation(
            message,
            'Are you sure that you want to **reset all aliases**?',
            async (interaction) => {
              try {
                const freshGuildData = await guildService.ensureGuildData(message.guild.id);
                freshGuildData.Aliases = [];
                await guildService.set(message.guild.id, freshGuildData);
                
                await interaction.update({
                  embeds: [embeds.success(message, 'Cleared **all aliases** for **commands**').embeds[0]],
                  components: []
                });
              } catch (error) {
                logger.webhook.error(error, message);
                await interaction.update({
                  embeds: [embeds.deny(message, 'Failed to **reset aliases**').embeds[0]],
                  components: []
                });
              }
            }
          );
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Failed to **reset aliases**');
        }
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');

    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return runHelpCommand(message, 'alias');
    }

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'alias');
  }
};
