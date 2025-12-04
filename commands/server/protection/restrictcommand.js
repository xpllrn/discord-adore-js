const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { getService } = require('@services');
const { findRole } = require('../../../handlers/finder');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

module.exports = {
  name: 'restrictcommand',
  aliases: ['restrictcmd', 'rc'],
  description: 'Restrict commands to specific roles only',
  syntax: 'restrictcommand [subcommand] [parameters]',
  example: 'restrictcommand add ban @Moderator',
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: [],
      description: 'Restrict a command to a specific role',
      syntax: '{guildprefix}restrictcommand add [command] [role]',
      parameters: ['command', 'role'],
      example: '{guildprefix}restrictcommand add ban @Moderator',

      handler: async (client, message, args, guildService) => {
        const commandName = args[0]?.toLowerCase();
        if (!commandName) {
          return embeds.warn(message, 'Please specify a command: `,restrictcommand add ban @Moderator`');
        }

        const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
        if (!command) {
          return embeds.warn(message, `Command \`${commandName}\` not found`);
        }

        const protectedCommands = ['disablecommand', 'enablecommand', 'restrictcommand', 'help'];
        if (protectedCommands.includes(command.name)) {
          return embeds.warn(message, `Cannot restrict the \`${command.name}\` command`);
        }

        const roleArg = args.slice(1).join(' ');
        if (!roleArg) {
          return embeds.warn(message, 'Please specify a role: `,restrictcommand add ban @Moderator`');
        }

        const roleResult = findRole(message.guild, roleArg);
        if (!roleResult.found) {
          return embeds.warn(message, roleResult.error);
        }
        const role = roleResult.role;

        const guildData = await guildService.ensureGuildData(message.guild.id);
        if (!guildData.RestrictedCommands) {
          guildData.RestrictedCommands = {};
        }

        if (!guildData.RestrictedCommands[command.name]) {
          guildData.RestrictedCommands[command.name] = [];
        }

        if (guildData.RestrictedCommands[command.name].includes(role.id)) {
          return embeds.warn(message, `Command \`${command.name}\` is already restricted to ${role}`);
        }

        guildData.RestrictedCommands[command.name].push(role.id);
        await guildService.set(message.guild.id, guildData);

        return embeds.success(message, `Restricted \`${command.name}\` to ${role}`);
      }
    },

    remove: {
      name: 'remove',
      aliases: [],
      description: 'Remove a role restriction from a command',
      syntax: '{guildprefix}restrictcommand remove [command] [role]',
      parameters: ['command', 'role'],
      example: '{guildprefix}restrictcommand remove ban @Moderator',

      handler: async (client, message, args, guildService) => {
        const commandName = args[0]?.toLowerCase();
        if (!commandName) {
          return embeds.warn(message, 'Please specify a command: `,restrictcommand remove ban @Moderator`');
        }

        const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
        if (!command) {
          return embeds.warn(message, `Command \`${commandName}\` not found`);
        }

        const roleArg = args.slice(1).join(' ');
        if (!roleArg) {
          return embeds.warn(message, 'Please specify a role: `,restrictcommand remove ban @Moderator`');
        }

        const roleResult = findRole(message.guild, roleArg);
        if (!roleResult.found) {
          return embeds.warn(message, roleResult.error);
        }
        const role = roleResult.role;

        const guildData = await guildService.ensureGuildData(message.guild.id);
        if (!guildData.RestrictedCommands?.[command.name]) {
          return embeds.warn(message, `Command \`${command.name}\` has no role restrictions`);
        }

        const idx = guildData.RestrictedCommands[command.name].indexOf(role.id);
        if (idx === -1) {
          return embeds.warn(message, `Command \`${command.name}\` is not restricted to ${role}`);
        }

        guildData.RestrictedCommands[command.name].splice(idx, 1);
        if (guildData.RestrictedCommands[command.name].length === 0) {
          delete guildData.RestrictedCommands[command.name];
        }
        await guildService.set(message.guild.id, guildData);

        return embeds.success(message, `Removed ${role} restriction from \`${command.name}\``);
      }
    },

    reset: {
      name: 'reset',
      aliases: [],
      description: 'Reset all command restrictions',
      syntax: '{guildprefix}restrictcommand reset',
      parameters: [],
      example: '{guildprefix}restrictcommand reset',

      handler: async (client, message, args, guildService) => {
        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (!guildData.RestrictedCommands || Object.keys(guildData.RestrictedCommands).length === 0) {
          return embeds.warn(message, 'No command restrictions are configured in this server');
        }

        const commandCount = Object.keys(guildData.RestrictedCommands).length;
        
        guildData.RestrictedCommands = {};
        await guildService.set(message.guild.id, guildData);

        return embeds.success(message, `Reset all restrictions for **${commandCount}** command(s)`);
      }
    },

    list: {
      name: 'list',
      aliases: ['show'],
      description: 'View all command restrictions',
      syntax: '{guildprefix}restrictcommand list',
      parameters: [],
      example: '{guildprefix}restrictcommand list',

      handler: async (client, message, args, guildService) => {
        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (!guildData.RestrictedCommands || Object.keys(guildData.RestrictedCommands).length === 0) {
          return embeds.warn(message, 'No command restrictions are configured in this server');
        }

        const entries = [];
        let count = 0;

        for (const [cmdName, roleIds] of Object.entries(guildData.RestrictedCommands)) {
          if (roleIds.length > 0) {
            count++;
            const roles = roleIds.map(id => {
              const role = message.guild.roles.cache.get(id);
              return role ? `${role}` : `Role (${id})`;
            }).join(', ');
            entries.push(`\`${String(count).padStart(2, '0')}\` \`${cmdName}\` - ${roles}`);
          }
        }

        if (entries.length === 0) {
          return embeds.warn(message, 'No command restrictions are configured in this server');
        }

        const embed = new EmbedBuilder()
          .setColor(colors.embed)
          .setAuthor({
            name: 'Restricted Commands',
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
        return runHelpCommand(message, 'restrictcommand');
      }

      const subcommand = Object.values(module.exports.subcommands)
        .find(s => s.name === sub || s.aliases.includes(sub));

      if (subcommand) {
        return subcommand.handler(client, message, args.slice(1), guildService);
      }

      return runHelpCommand(message, 'restrictcommand');
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while executing this command');
    }
  }
};
