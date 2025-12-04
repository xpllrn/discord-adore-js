const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { checkUserRoleHierarchy, checkBotRoleHierarchy, hasMultipleDiscordPermissions } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { ensureGuildData } = require('../../../database');
const { createConfirmation } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');
const { findRole } = require('../../../handlers/finder');

module.exports = {
  name: "autorole",
  aliases: ['ar'],
  description: `Set up automatic role assign on member join`,
  syntax: 'autorole [subcommand] (parameters)',
  example: 'autorole add @Member',
  permission: 'manage_guild_&_manage_roles',
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: ['create'],
      description: 'Adds a autorole and assigns on join to member',
      syntax: '{guildprefix}autorole add [role]',
      parameters: ['role'],
      example: '{guildprefix}autorole add Member',

      handler: async (client, message, args, guildService) => {
        const roleName = args.join(' ');
        if (!roleName) return runHelpCommand(message, 'autorole');

        const roleResult = findRole(message.guild, roleName);
        if (!roleResult.found) return embeds.deny(message, roleResult.error);

        const role = roleResult.role;

        if (!checkUserRoleHierarchy(message, role)) return;
        if (!checkBotRoleHierarchy(message, role)) return;

        const currentAutoRoles = await guildService.getAutoRoles(message.guild.id) || [];

        if (currentAutoRoles.includes(role.id)) {
          return embeds.warn(message, `**${role.name}** is already an auto role`);
        }

        if (currentAutoRoles.length >= 10) {
          return embeds.deny(message, 'You have added **max autoroles (10)**. Please remove some first.');
        }

        await guildService.addAutoRole(message.guild.id, role.id);
        return embeds.success(message, `**${role.name}** has been added to auto roles`);
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete', 'del', 'rm'],
      description: 'Removes a autorole and stops assigning on join',
      syntax: '{guildprefix}autorole remove [role]',
      parameters: ['role'],
      example: '{guildprefix}autorole remove Member',

      handler: async (client, message, args, guildService) => {
        const roleName = args.join(' ');
        if (!roleName) return runHelpCommand(message, 'autorole');

        const roleResult = findRole(message.guild, roleName);
        if (!roleResult.found) return embeds.deny(message, roleResult.error);

        const role = roleResult.role;
        const autoRoles = await guildService.getAutoRoles(message.guild.id);

        if (!autoRoles || autoRoles.length === 0) {
          return embeds.deny(message, `No auto roles found`);
        }

        if (!autoRoles.includes(role.id)) {
          return embeds.deny(message, `**${role.name}** is not an auto role`);
        }

        await guildService.removeAutoRole(message.guild.id, role.id);
        return embeds.success(message, `Removed **${role.name}** from auto roles`);
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'Lists all autoroles configured for the guild',
      syntax: '{guildprefix}autorole list',
      parameters: [],
      example: '{guildprefix}autorole list',

      handler: async (client, message, args, guildService) => {
        const autoRoles = await guildService.getAutoRoles(message.guild.id);

        if (!autoRoles || autoRoles.length === 0) {
          return embeds.warn(message, 'No auto roles found');
        }

        const validRoles = [];
        for (const roleId of autoRoles) {
          const role = message.guild.roles.cache.get(roleId);
          if (role) {
            validRoles.push(roleId);
          } else {
            await guildService.removeAutoRole(message.guild.id, roleId);
          }
        }

        if (validRoles.length === 0) {
          return embeds.warn(message, 'No auto roles found');
        }

        const roleList = validRoles.map((roleId, index) => {
          const role = message.guild.roles.cache.get(roleId);
          const roleNumber = (index + 1).toString().padStart(2, '0');
          return `\`${roleNumber}\` **${role.name}** (\`${roleId}\`)`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle('Auto Roles')
          .setDescription(roleList)
          .setFooter({ text: `${validRoles.length}/10 auto roles` });

        return message.channel.send({ embeds: [embed] });
      }
    },

    reset: {
      name: 'reset',
      aliases: ['clear'],
      description: 'Clears every autorole for guild',
      syntax: '{guildprefix}autorole reset',
      parameters: [],
      example: '{guildprefix}autorole reset',

      handler: async (client, message, args, guildService) => {
        const autoRoles = await guildService.getAutoRoles(message.guild.id);

        if (!autoRoles || autoRoles.length === 0) {
          return embeds.warn(message, 'No auto roles found');
        }

        await createConfirmation(
          message,
          'Are you sure you want to **remove all auto roles**?',
          async (interaction) => {
            await guildService.clearAllAutoRoles(message.guild.id);
            const successEmbed = embeds.createSuccess(message, 'Removed all auto roles');
            await interaction.update({ embeds: [successEmbed], components: [] });
          }
        );
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');
    await ensureGuildData(message.guild.id);

    const sub = args[0]?.toLowerCase();
    if (!sub) return runHelpCommand(message, 'autorole');

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'autorole');
  }
};
