const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { getService } = require('@services');
const { findRole, findChannel } = require('../../../handlers/finder');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

module.exports = {
  name: 'disablecommand',
  aliases: ['disablecmd', 'dcmd'],
  description: 'Disable commands in specific channels or for specific roles',
  syntax: 'disablecommand [subcommand] [parameters]',
  example: 'disablecommand #general ban',
  isGroupCommand: true,

  subcommands: {
    channel: {
      name: 'channel',
      aliases: [],
      description: 'Disable a command in a specific channel',
      syntax: '{guildprefix}disablecommand [channel] [command]',
      parameters: ['channel', 'command'],
      example: '{guildprefix}disablecommand #general ban',

      handler: async (client, message, args, guildService) => {
        const channelArg = args[0];
        if (!channelArg) {
          return embeds.warn(message, 'Please specify a channel: `,disablecommand #general ban`');
        }

        const channelResult = findChannel(message.guild, channelArg);
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }
        const channel = channelResult.channel;

        const commandName = args[1]?.toLowerCase();
        if (!commandName) {
          return embeds.warn(message, 'Please specify a command: `,disablecommand #general ban`');
        }

        // Verify command exists
        const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
        if (!command) {
          return embeds.warn(message, `Command \`${commandName}\` not found`);
        }

        // Prevent disabling critical commands
        const protectedCommands = ['disablecommand', 'enablecommand', 'restrictcommand', 'help'];
        if (protectedCommands.includes(command.name)) {
          return embeds.warn(message, `Cannot disable the \`${command.name}\` command`);
        }

        const guildData = await guildService.ensureGuildData(message.guild.id);
        if (!guildData.DisabledCommands) {
          guildData.DisabledCommands = { channels: {}, roles: {}, global: [] };
        }
        if (!guildData.DisabledCommands.channels) {
          guildData.DisabledCommands.channels = {};
        }

        if (!guildData.DisabledCommands.channels[channel.id]) {
          guildData.DisabledCommands.channels[channel.id] = [];
        }

        if (guildData.DisabledCommands.channels[channel.id].includes(command.name)) {
          return embeds.warn(message, `Command \`${command.name}\` is already disabled in ${channel}`);
        }

        guildData.DisabledCommands.channels[channel.id].push(command.name);
        await guildService.set(message.guild.id, guildData);

        return embeds.success(message, `Disabled \`${command.name}\` in ${channel}`);
      }
    },

    role: {
      name: 'role',
      aliases: [],
      description: 'Disable a command for a specific role',
      syntax: '{guildprefix}disablecommand role [role] [command]',
      parameters: ['role', 'command'],
      example: '{guildprefix}disablecommand role @Member ban',

      handler: async (client, message, args, guildService) => {
        const roleArg = args[0];
        if (!roleArg) {
          return embeds.warn(message, 'Please specify a role: `,disablecommand role @Member ban`');
        }

        const roleResult = findRole(message.guild, roleArg);
        if (!roleResult.found) {
          return embeds.warn(message, roleResult.error);
        }
        const role = roleResult.role;

        const commandName = args[1]?.toLowerCase();
        if (!commandName) {
          return embeds.warn(message, 'Please specify a command: `,disablecommand role @Member ban`');
        }

        const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
        if (!command) {
          return embeds.warn(message, `Command \`${commandName}\` not found`);
        }

        const protectedCommands = ['disablecommand', 'enablecommand', 'restrictcommand', 'help'];
        if (protectedCommands.includes(command.name)) {
          return embeds.warn(message, `Cannot disable the \`${command.name}\` command`);
        }

        const guildData = await guildService.ensureGuildData(message.guild.id);
        if (!guildData.DisabledCommands) {
          guildData.DisabledCommands = { channels: {}, roles: {}, global: [] };
        }
        if (!guildData.DisabledCommands.roles) {
          guildData.DisabledCommands.roles = {};
        }

        if (!guildData.DisabledCommands.roles[role.id]) {
          guildData.DisabledCommands.roles[role.id] = [];
        }

        if (guildData.DisabledCommands.roles[role.id].includes(command.name)) {
          return embeds.warn(message, `Command \`${command.name}\` is already disabled for ${role}`);
        }

        guildData.DisabledCommands.roles[role.id].push(command.name);
        await guildService.set(message.guild.id, guildData);

        return embeds.success(message, `Disabled \`${command.name}\` for ${role}`);
      }
    },

    all: {
      name: 'all',
      aliases: ['global'],
      description: 'Disable a command server-wide',
      syntax: '{guildprefix}disablecommand all [command]',
      parameters: ['command'],
      example: '{guildprefix}disablecommand all ban',

      handler: async (client, message, args, guildService) => {
        const commandName = args[0]?.toLowerCase();
        if (!commandName) {
          return embeds.warn(message, 'Please specify a command: `,disablecommand all ban`');
        }

        const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
        if (!command) {
          return embeds.warn(message, `Command \`${commandName}\` not found`);
        }

        const protectedCommands = ['disablecommand', 'enablecommand', 'restrictcommand', 'help'];
        if (protectedCommands.includes(command.name)) {
          return embeds.warn(message, `Cannot disable the \`${command.name}\` command`);
        }

        const guildData = await guildService.ensureGuildData(message.guild.id);
        if (!guildData.DisabledCommands) {
          guildData.DisabledCommands = { channels: {}, roles: {}, global: [] };
        }
        if (!guildData.DisabledCommands.global) {
          guildData.DisabledCommands.global = [];
        }

        if (guildData.DisabledCommands.global.includes(command.name)) {
          return embeds.warn(message, `Command \`${command.name}\` is already disabled server-wide`);
        }

        guildData.DisabledCommands.global.push(command.name);
        await guildService.set(message.guild.id, guildData);

        return embeds.success(message, `Disabled \`${command.name}\` server-wide`);
      }
    },

    list: {
      name: 'list',
      aliases: ['show'],
      description: 'View all disabled commands',
      syntax: '{guildprefix}disablecommand list',
      parameters: [],
      example: '{guildprefix}disablecommand list',

      handler: async (client, message, args, guildService) => {
        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (!guildData.DisabledCommands) {
          return embeds.warn(message, 'No commands are disabled in this server');
        }

        const { channels = {}, roles = {}, global = [] } = guildData.DisabledCommands;
        const entries = [];
        let count = 0;

        // Global disabled commands
        if (global.length > 0) {
          count++;
          entries.push(`\`${String(count).padStart(2, '0')}\` **Server-wide** - ${global.map(c => `\`${c}\``).join(', ')}`);
        }

        // Channel disabled commands
        for (const [channelId, commands] of Object.entries(channels)) {
          if (commands.length > 0) {
            count++;
            const channel = message.guild.channels.cache.get(channelId);
            const channelDisplay = channel ? `${channel}` : `Channel (${channelId})`;
            entries.push(`\`${String(count).padStart(2, '0')}\` ${channelDisplay} - ${commands.map(c => `\`${c}\``).join(', ')}`);
          }
        }

        // Role disabled commands
        for (const [roleId, commands] of Object.entries(roles)) {
          if (commands.length > 0) {
            count++;
            const role = message.guild.roles.cache.get(roleId);
            const roleDisplay = role ? `${role}` : `Role (${roleId})`;
            entries.push(`\`${String(count).padStart(2, '0')}\` ${roleDisplay} - ${commands.map(c => `\`${c}\``).join(', ')}`);
          }
        }

        if (entries.length === 0) {
          return embeds.warn(message, 'No commands are disabled in this server');
        }

        const embed = new EmbedBuilder()
          .setColor(colors.embed)
          .setAuthor({
            name: 'Disabled Commands',
            iconURL: message.author.displayAvatarURL({ dynamic: true })
          })
          .setDescription(entries.join('\n'))
          .setFooter({
            text: `Page 1/1 (${count} ${count === 1 ? 'entry' : 'entries'})`
          });

        return message.channel.send({ embeds: [embed] });
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
        return runHelpCommand(message, 'disablecommand');
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

      return runHelpCommand(message, 'disablecommand');
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while executing this command');
    }
  }
};
