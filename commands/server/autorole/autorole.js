const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { checkUserRoleHierarchy, checkBotRoleHierarchy } = require('../../utils/permissions');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { ensureGuildData } = require('../../database');
const { createConfirmation } = require('../../core/buttons');
const { getService } = require('@services');
const config = require('../../config/setup');
const { findRole } = require('../../handlers/finder');

module.exports = {
  name: "autorole",
  aliases: ['ar'],
  description: `Set up automatic role assign on member join`,
  permission: 'Manage Guild & Manage Roles',
  isGroupCommand: true,
  run: async (client, message, args) => {
    const guildService = getService('guild');

    await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {
      const subcommandInfo = {
        description: 'Adds a autorole and assigns on join to member',
        usage: '{guildprefix}autorole add [role]',
        aliases: ['create'],
        parameters: ['role'],
        example: '{guildprefix}autorole add Member'
      };

      const roleName = args.slice(1).join(' ');

      if (!roleName) {
        return runHelpCommand(message, 'autorole');
      }

      const roleResult = message.mentions.roles.first() ?
        { found: true, role: message.mentions.roles.first() } :
        findRole(message.guild, roleName);

      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }

      const role = roleResult.role;

      // Hierarchy checks
      if (!checkUserRoleHierarchy(message, role)) return;
      if (!checkBotRoleHierarchy(message, role)) return;

      // Get current auto roles using cache system
      const currentAutoRoles = await guildService.getAutoRoles(message.guild.id) || [];

      // Check if role is already in autoroles
      if (currentAutoRoles.includes(role.id)) {
        return embeds.warn(message, `**${role.name}** is already an auto role`);
      }

      // Check if we've reached the 10 role limit
      if (currentAutoRoles.length >= 10) {
        return embeds.deny(message, 'You have added **max autoroles (10)**. Please remove some first.');
      }

      // Add the new role using cache system
      await guildService.addAutoRole(message.guild.id, role.id);

      return embeds.success(message, `**${role.name}** has been added to auto roles`);



    } else if (args[0] === 'reset') {
      const subcommandInfo = {
        description: 'Clears every autorole for guild',
        usage: '{guildprefix}autorole reset',
        aliases: ['clear'],
        parameters: [],
        example: '{guildprefix}autorole reset'
      };

      const autoRoles = await guildService.getAutoRoles(message.guild.id);

      if (autoRoles && autoRoles.length > 0) {
        // Show confirmation dialog
        await createConfirmation(
          message,
          'Are you sure you want to **remove all auto roles**?',
          async (interaction) => {
            // On approve: delete all auto roles using cache system
            await guildService.clearAllAutoRoles(message.guild.id);

            // Edit the confirmation embed to show success message
            const successEmbed = embeds.createSuccess(message, 'Removed all auto roles');

            await interaction.update({ embeds: [successEmbed], components: [] });
          }
        );
      } else {
        return embeds.warn(message, 'No auto roles found');
      }



    } else if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'Lists all autoroles configured for the guild',
        usage: '{guildprefix}autorole list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}autorole list'
      };

      const autoRoles = await guildService.getAutoRoles(message.guild.id);

      if (autoRoles && autoRoles.length > 0) {
        // Clean up invalid roles before displaying
        const validRoles = [];
        for (const roleId of autoRoles) {
          const role = message.guild.roles.cache.get(roleId);
          if (role) {
            validRoles.push(roleId);
          } else {
            // Remove invalid role using cache system
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

      } else {
        return embeds.warn(message, 'No auto roles found');
      }



    } else if (args[0] === 'remove' || args[0] === 'rm' || args[0] === 'delete' || args[0] === 'del') {
      const subcommandInfo = {
        description: 'Removes a autorole and stops assigning on join',
        usage: '{guildprefix}autorole remove [role]',
        aliases: ['delete', 'del', 'rm'],
        parameters: ['role'],
        example: '{guildprefix}autorole remove Member'
      };

      const roleName = args.slice(1).join(' ');

      if (!roleName) {
        return runHelpCommand(message, 'autorole');
      }

      const roleResult = message.mentions.roles.first() ?
        { found: true, role: message.mentions.roles.first() } :
        findRole(message.guild, roleName);

      if (!roleResult.found) {
        return embeds.deny(message, roleResult.error);
      }

      const role = roleResult.role;
      const autoRoles = await guildService.getAutoRoles(message.guild.id);

      if (autoRoles && autoRoles.length > 0) {
        if (!autoRoles.includes(role.id)) {
          return embeds.deny(message, `**${role.name}** is not an auto role`);
        }

        // Remove the role using cache system
        await guildService.removeAutoRole(message.guild.id, role.id);

        return embeds.success(message, `Removed **${role.name}** from auto roles`);
      } else {
        return embeds.deny(message, `No auto roles found`);
      }

    } else {
      return runHelpCommand(message, 'autorole');
    }

  }
}
