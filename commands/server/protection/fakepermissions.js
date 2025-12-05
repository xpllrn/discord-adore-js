const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { getService } = require('@services');
const { findRole } = require('../../../handlers/finder');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const logger = require('../../../utils/logger');

const permissionMap = {
  'administrator': 'administrator',
  'admin': 'administrator',
  'ban_members': 'ban_members',
  'banmembers': 'ban_members',
  'ban': 'ban_members',
  'kick_members': 'kick_members',
  'kickmembers': 'kick_members',
  'kick': 'kick_members',
  'moderate_members': 'moderate_members',
  'moderatemembers': 'moderate_members',
  'timeout': 'moderate_members',
  'manage_guild': 'manage_guild',
  'manage_channels': 'manage_channels',
  'managechannels': 'manage_channels',
  'channels': 'manage_channels',
  'manage_roles': 'manage_roles',
  'manageroles': 'manage_roles',
  'roles': 'manage_roles',
  'manage_webhooks': 'manage_webhooks',
  'managewebhooks': 'manage_webhooks',
  'webhooks': 'manage_webhooks',
  'manage_expressions': 'manage_expressions',
  'manageexpressions': 'manage_expressions',
  'manageguildexpressions': 'manage_expressions',
  'expressions': 'manage_expressions',
  'emojis': 'manage_expressions',
  'manage_nicknames': 'manage_nicknames',
  'managenicknames': 'manage_nicknames',
  'nicknames': 'manage_nicknames',
  'change_nickname': 'change_nickname',
  'changenickname': 'change_nickname',
  'manage_messages': 'manage_messages',
  'managemessages': 'manage_messages',
  'messages': 'manage_messages'
};

const validPermissions = [
  'administrator',
  'ban_members',
  'kick_members',
  'manage_channels',
  'manage_expressions',
  'manage_guild',
  'manage_messages',
  'manage_roles',
  'manage_webhooks',
  'moderate_members',
  'change_nickname',
  'manage_nicknames'
];

module.exports = {
  name: 'fakepermissions',
  aliases: ['fakeperms', 'fp'],
  description: 'Restrict moderators to only use bot commands for moderation',
  syntax: 'fakepermissions [subcommand] [parameters]',
  example: 'fakepermissions add @Moderator ban_members',
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: ['grant'],
      description: 'Add fake permissions to a role',
      syntax: '{guildprefix}fakepermissions add [role] [permissions]',
      parameters: ['role', 'permissions'],
      example: '{guildprefix}fakepermissions add @Moderator ban_members',

      handler: async (client, message, args, guildService) => {
        const roleArg = args[0];
        if (!roleArg) {
          return embeds.warn(message, 'Please specify a role: `,fakepermissions add @Moderator ban_members`');
        }

        const roleResult = findRole(message.guild, roleArg);
        if (!roleResult.found) {
          return embeds.warn(message, roleResult.error);
        }
        const role = roleResult.role;

        const permissionArgs = args.slice(1);
        if (permissionArgs.length === 0) {
          return embeds.warn(message, 'Please specify at least one permission: `,fakepermissions add @Moderator ban_members kick_members`');
        }

        const permissions = [];
        const invalidPerms = [];

        for (const permArg of permissionArgs) {
          const perm = permissionMap[permArg.toLowerCase()] || 
                       permArg.charAt(0).toUpperCase() + permArg.slice(1);
          
          if (validPermissions.includes(perm)) {
            permissions.push(perm);
          } else {
            invalidPerms.push(permArg);
          }
        }

        if (invalidPerms.length > 0) {
          return embeds.warn(
            message,
            `Invalid permissions: ${invalidPerms.map(p => `\`${p}\``).join(', ')}\n\nValid permissions:\n${validPermissions.map(p => `\`${p}\``).join(', ')}`
          );
        }

        if (permissions.length === 0) {
          return embeds.warn(message, 'No valid permissions provided');
        }

        const guildData = await guildService.ensureGuildData(message.guild.id);
        if (!guildData.FakePermissions) {
          guildData.FakePermissions = {};
        }

        if (!guildData.FakePermissions[role.id]) {
          guildData.FakePermissions[role.id] = {
            roleId: role.id,
            roleName: role.name,
            permissions: []
          };
        }

        const existingPerms = guildData.FakePermissions[role.id].permissions || [];
        const newPerms = permissions.filter(p => !existingPerms.includes(p));
        const alreadyAdded = permissions.filter(p => existingPerms.includes(p));

        if (newPerms.length === 0) {
          return embeds.warn(
            message,
            `All specified permissions are already added to **${role.name}**:\n${alreadyAdded.map(p => `\`${p}\``).join(', ')}`
          );
        }

        guildData.FakePermissions[role.id].permissions = [...existingPerms, ...newPerms];
        guildData.FakePermissions[role.id].roleName = role.name;

        await guildService.set(message.guild.id, guildData);

        const permissionWord = newPerms.length === 1 ? 'permission' : 'permissions';
        const permsList = newPerms.map(p => `\`${p}\``).join(', ');
        const responseMsg = `Granted fake **${permissionWord}** ${permsList} for ${role}`;

        return embeds.success(message, responseMsg);
      }
    },

    remove: {
      name: 'remove',
      aliases: [],
      description: 'Remove fake permissions from a role',
      syntax: '{guildprefix}fakepermissions remove [role] [permissions]',
      parameters: ['role', 'permissions'],
      example: '{guildprefix}fakepermissions remove @Moderator ban_members',

      handler: async (client, message, args, guildService) => {
        const roleArg = args[0];
        if (!roleArg) {
          return embeds.warn(message, 'Please specify a role: `,fakepermissions remove @Moderator ban_members`');
        }

        const roleResult = findRole(message.guild, roleArg);
        if (!roleResult.found) {
          return embeds.warn(message, roleResult.error);
        }
        const role = roleResult.role;

        const permissionArgs = args.slice(1);
        if (permissionArgs.length === 0) {
          return embeds.warn(message, 'Please specify at least one permission: `,fakepermissions remove @Moderator ban_members`');
        }

        const permissions = permissionArgs.map(p => 
          permissionMap[p.toLowerCase()] || p.charAt(0).toUpperCase() + p.slice(1)
        );

        const guildData = await guildService.ensureGuildData(message.guild.id);
        if (!guildData.FakePermissions || !guildData.FakePermissions[role.id]) {
          return embeds.warn(message, `**${role.name}** has no fake permissions configured`);
        }

        const existingPerms = guildData.FakePermissions[role.id].permissions || [];
        const toRemove = permissions.filter(p => existingPerms.includes(p));
        const notFound = permissions.filter(p => !existingPerms.includes(p));

        if (toRemove.length === 0) {
          return embeds.warn(
            message,
            `None of the specified permissions are assigned to **${role.name}**:\n${notFound.map(p => `\`${p}\``).join(', ')}`
          );
        }

        guildData.FakePermissions[role.id].permissions = existingPerms.filter(p => !toRemove.includes(p));

        if (guildData.FakePermissions[role.id].permissions.length === 0) {
          delete guildData.FakePermissions[role.id];
        }

        await guildService.set(message.guild.id, guildData);

        let responseMsg = `Removed fake permissions from **${role.name}**:\n${toRemove.map(p => `\`${p}\``).join(', ')}`;
        
        if (notFound.length > 0) {
          responseMsg += `\n\n> Not found: ${notFound.map(p => `\`${p}\``).join(', ')}`;
        }

        return embeds.success(message, responseMsg);
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'View fake permissions for a role or all roles',
      syntax: '{guildprefix}fakepermissions list [role]',
      parameters: ['role (optional)'],
      example: '{guildprefix}fakepermissions list @Moderator',

      handler: async (client, message, args, guildService) => {
        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        const roleArg = args[0];
        if (!roleArg) {
          if (!guildData.FakePermissions || Object.keys(guildData.FakePermissions).length === 0) {
            return embeds.warn(message, 'No fake permissions are configured in this server');
          }

          const fakePermissions = guildData.FakePermissions;
          const roleEntries = Object.values(fakePermissions).filter(r => r.permissions && r.permissions.length > 0);

          if (roleEntries.length === 0) {
            return embeds.warn(message, 'No fake permissions are configured in this server');
          }

          const entries = roleEntries.map((roleData, index) => {
            const role = message.guild.roles.cache.get(roleData.roleId);
            const permissions = roleData.permissions || [];
            const permsList = permissions.map(p => `\`${p}\``).join(', ');
            const roleDisplay = role ? `${role}` : `**${roleData.roleName}** (Deleted)`;
            const num = String(index + 1).padStart(2, '0');
            
            return `\`${num}\` ${roleDisplay} - ${permsList}`;
          }).join('\n');

          const embed = new EmbedBuilder()
            .setColor(colors.embed)
            .setAuthor({
              name: 'Fake Permissions',
              iconURL: message.author.displayAvatarURL({ dynamic: true })
            })
            .setDescription(entries)
            .setFooter({
              text: `Page 1/1 (${roleEntries.length} ${roleEntries.length === 1 ? 'entry' : 'entries'})`
            });

          return message.channel.send({ embeds: [embed] });
        }

        const roleResult = findRole(message.guild, roleArg);
        if (!roleResult.found) {
          return embeds.warn(message, roleResult.error);
        }
        const role = roleResult.role;

        if (!guildData.FakePermissions || !guildData.FakePermissions[role.id]) {
          return embeds.warn(message, `**${role.name}** has no fake permissions configured`);
        }

        const fakePerms = guildData.FakePermissions[role.id];
        const permissions = fakePerms.permissions || [];

        if (permissions.length === 0) {
          return embeds.warn(message, `**${role.name}** has no fake permissions configured`);
        }

        const permsList = permissions.map(p => `\`${p}\``).join(', ');
        const description = `\`01\` ${role} - ${permsList}`;

        const embed = new EmbedBuilder()
          .setColor(colors.embed)
          .setAuthor({
            name: `Fake Permissions for ${role.name}`,
            iconURL: message.author.displayAvatarURL({ dynamic: true })
          })
          .setDescription(description)
          .setFooter({
            text: `Page 1/1 (1 entry)`
          });

        return message.channel.send({ embeds: [embed] });
      }
    },

    reset: {
      name: 'reset',
      aliases: [],
      description: 'Reset all fake permissions',
      syntax: '{guildprefix}fakepermissions reset',
      parameters: [],
      example: '{guildprefix}fakepermissions reset',

      handler: async (client, message, args, guildService) => {
        const guildData = await guildService.ensureGuildData(message.guild.id);
        
        if (!guildData.FakePermissions || Object.keys(guildData.FakePermissions).length === 0) {
          return embeds.warn(message, 'No fake permissions are configured in this server');
        }

        const roleCount = Object.keys(guildData.FakePermissions).length;
        
        guildData.FakePermissions = {};
        await guildService.set(message.guild.id, guildData);

        return embeds.success(message, `Reset all fake permissions for **${roleCount}** role(s)`);
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
        return runHelpCommand(message, 'fakepermissions');
      }

      const subcommand = Object.values(module.exports.subcommands)
        .find(s => s.name === sub || s.aliases.includes(sub));

      if (subcommand) {
        return subcommand.handler(client, message, args.slice(1), guildService);
      }

      return runHelpCommand(message, 'fakepermissions');
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while executing this command');
    }
  }
};
