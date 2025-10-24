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
  usage: `{guildprefix}autorole add [role]
{guildprefix}autorole remove [role]
{guildprefix}autorole list
{guildprefix}autorole reset`,
  permission: 'Manage Guild & Manage Roles',
  run: async(client, message, args) => {
    const guildService = getService('guild');

    await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {

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
            const successEmbed = new EmbedBuilder()
              .setColor(config.colors.success)
              .setDescription(`✅ <@${message.author.id}>: Removed all auto roles`);

            await interaction.editReply({ embeds: [successEmbed], components: [] });
          }
        );
      } else {
        return embeds.warn(message, 'No auto roles found');
      }



    } else if (args[0] === 'list') {

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
