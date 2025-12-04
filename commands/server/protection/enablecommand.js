const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { getService } = require('@services');
const { findRole, findChannel } = require('../../../handlers/finder');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

module.exports = {
  name: 'enablecommand',
  aliases: ['enablecmd', 'ec'],
  description: 'Enable previously disabled commands',
  syntax: 'enablecommand [subcommand] [parameters]',
  example: 'enablecommand #general ban',
  isGroupCommand: true,

  subcommands: {
    channel: {
      name: 'channel',
      aliases: [],
      description: 'Enable a command in a specific channel',
      syntax: '{guildprefix}enablecommand [channel] [command]',
      parameters: ['channel', 'command'],
      example: '{guildprefix}enablecommand #general ban',

      handler: async (client, message, args, guildService) => {
        const channelArg = args[0];
        if (!channelArg) {
          return embeds.warn(message, 'Please specify a channel: `,enablecommand #general ban`');
        }

        const channelResult = findChannel(message.guild, channelArg);
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }
        const channel = channelResult.channel;

        const commandName = args[1]?.toLowerCase();
        if (!commandName) {
          return embeds.warn(message, 'Please specify a command: `,enablecommand #general ban`');
        }

        const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
        if (!command) {
          return embeds.warn(message, `Command \`${commandName}\` not found`);
        }

        const guildData = await guildService.ensureGuildData(message.guild.id);
        if (!guildData.DisabledCommands?.channels?.[channel.id]) {
          return embeds.warn(message, `Command \`${command.name}\` is not disabled in ${channel}`);
        }

        const idx = guildData.DisabledCommands.channels[channel.id].indexOf(command.name);
        if (idx === -1) {
          return embeds.warn(message, `Command \`${command.name}\` is not disabled in ${channel}`);
        }

        guildData.DisabledCommands.channels[channel.id].splice(idx, 1);
        if (guildData.DisabledCommands.channels[channel.id].length === 0) {
          delete guildData.DisabledCommands.channels[channel.id];
        }
        await guildService.set(message.guild.id, guildData);

        return embeds.success(message, `Enabled \`${command.name}\` in ${channel}`);
      }
    },

    role: {
      name: 'role',
      aliases: [],
      description: 'Enable a command for a specific role',
      syntax: '{guildprefix}enablecommand role [role] [command]',
      parameters: ['role', 'command'],
      example: '{guildprefix}enablecommand role @Member ban',

      handler: async (client, message, args, guildService) => {
        const roleArg = args[0];
        if (!roleArg) {
          return embeds.warn(message, 'Please specify a role: `,enablecommand role @Member ban`');
        }

        const roleResult = findRole(message.guild, roleArg);
        if (!roleResult.found) {
          return embeds.warn(message, roleResult.error);
        }
        const role = roleResult.role;

        const commandName = args[1]?.toLowerCase();
        if (!commandName) {
          return embeds.warn(message, 'Please specify a command: `,enablecommand role @Member ban`');
        }

        const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
        if (!command) {
          return embeds.warn(message, `Command \`${commandName}\` not found`);
        }

        const guildData = await guildService.ensureGuildData(message.guild.id);
        if (!guildData.DisabledCommands?.roles?.[role.id]) {
          return embeds.warn(message, `Command \`${command.name}\` is not disabled for ${role}`);
        }

        const idx = guildData.DisabledCommands.roles[role.id].indexOf(command.name);
        if (idx === -1) {
          return embeds.warn(message, `Command \`${command.name}\` is not disabled for ${role}`);
        }

        guildData.DisabledCommands.roles[role.id].splice(idx, 1);
        if (guildData.DisabledCommands.roles[role.id].length === 0) {
          delete guildData.DisabledCommands.roles[role.id];
        }
        await guildService.set(message.guild.id, guildData);

        return embeds.success(message, `Enabled \`${command.name}\` for ${role}`);
      }
    },

    all: {
      name: 'all',
      aliases: ['global'],
      description: 'Enable a command server-wide',
      syntax: '{guildprefix}enablecommand all [command]',
      parameters: ['command'],
      example: '{guildprefix}enablecommand all ban',

      handler: async (client, message, args, guildService) => {
        const commandName = args[0]?.toLowerCase();
        if (!commandName) {
          return embeds.warn(message, 'Please specify a command: `,enablecommand all ban`');
        }

        const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
        if (!command) {
          return embeds.warn(message, `Command \`${commandName}\` not found`);
        }

        const guildData = await guildService.ensureGuildData(message.guild.id);
        if (!guildData.DisabledCommands?.global) {
          return embeds.warn(message, `Command \`${command.name}\` is not disabled server-wide`);
        }

        const idx = guildData.DisabledCommands.global.indexOf(command.name);
        if (idx === -1) {
          return embeds.warn(message, `Command \`${command.name}\` is not disabled server-wide`);
        }

        guildData.DisabledCommands.global.splice(idx, 1);
        await guildService.set(message.guild.id, guildData);

        return embeds.success(message, `Enabled \`${command.name}\` server-wide`);
      }
    }
  },

  run: async (client, message, args) => {
    try {
      const guildService = getService('guild');
      const isOwner = message.guild.ownerId === message.author.id;

      if (!isOwner) {
        return embeds.deny(message, 'Only the **server owner** can use this command');
      }

      const sub = args[0]?.toLowerCase();
      if (!sub) {
        return runHelpCommand(message, 'enablecommand');
      }

      // Check if first arg is a channel mention/name (shortcut for channel subcommand)
      const channelResult = findChannel(message.guild, sub);
      if (channelResult.found) {
        return module.exports.subcommands.channel.handler(client, message, args, guildService);
      }

      const subcommand = Object.values(module.exports.subcommands)
        .find(s => s.name === sub || s.aliases.includes(sub));

      if (subcommand) {
        return subcommand.handler(client, message, args.slice(1), guildService);
      }

      return runHelpCommand(message, 'enablecommand');
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while executing this command');
    }
  }
};
