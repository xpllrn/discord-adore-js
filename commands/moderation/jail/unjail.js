const { PermissionFlagsBits } = require("discord.js");
const { hasDiscordPermission, checkSelfAction, checkBotAction, checkUserMemberHierarchy, checkBotMemberHierarchy, checkDiscordActionable, checkBotRoleHierarchy } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { findUser, findRole } = require('../../../handlers/finder');
const webhookLogger = require('../../../utils/webhookLogger');
const logger = require('../../../utils/logger');
const { getService } = require('@services');

module.exports = {
  name: "unjail",
  description: `unjails the specified member`,
  syntax: 'unjail (user) (reason)',
  example: 'unjail @vwsn appeal',
  permission: 'Manage Roles',
  run: async(client, message, args) => {

    const guildService = getService('guild');
    const moderationService = getService('moderation');

    // Permission checks first
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageRoles, 'Manage Roles')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return embeds.deny(message, 'I need **Manage Roles** permission to use this command');
    }

    // Check if user provided input
    if (!args[0]) {
      return runHelpCommand(message, 'unjail');
    }

    // Use universal user finder
    const userResult = await findUser(message.guild, args[0], client);

    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }

    if (userResult.isGlobal) {
      return embeds.deny(message, 'User is not in this server');
    }

    const user = userResult.user;
    let reason = args.slice(1).join(" ");
    if (!reason) reason = 'reasons';

    // Self-action check
    if (!checkSelfAction(message, user.user, 'unjail')) return;

    // Bot-action check
    if (!checkBotAction(message, user.user)) return;

    // Hierarchy checks
    if (!checkUserMemberHierarchy(message, user)) return;
    if (!checkBotMemberHierarchy(message, user)) return;

    // Check if Discord allows role management on this member
    if (!checkDiscordActionable(message, user, 'manage roles')) return;

    // Check if jail role exists using universal finder
    const jailRoleResult = findRole(message.guild, 'jailed');

    if (!jailRoleResult.found) {
      return embeds.deny(message, `Jail role not found! Please run \`,jailsetup\` first to set up the jail system.`);
    }

    const jailRole = jailRoleResult.role;

    // Check if bot can manage the jail role
    if (!checkBotRoleHierarchy(message, jailRole)) return;

    // Check if user is actually jailed
    if (!user.roles.cache.has(jailRole.id)) {
      return embeds.warn(message, `**${user.user.username}** is not jailed`);
    }

    try {
      // Get saved roles using database helper (with timeout protection)
      const { getSavedUserRoles } = require('../../../database');
      const savedRoles = await getSavedUserRoles(message.guild.id, user.user.id);
      console.log(`[UNJAIL DEBUG] User: ${user.user.tag}, Saved roles:`, savedRoles);

      // Remove jail role and restore saved roles
      try {
        if (savedRoles && savedRoles.length > 0) {
          // Filter out roles that no longer exist in the guild and exclude booster role
          const validRoles = savedRoles.filter(roleId => {
            const role = message.guild.roles.cache.get(roleId);
            // Check if role exists and is not a booster role
            return role && !role.tags?.premiumSubscriberRole;
          });

          console.log(`[UNJAIL DEBUG] Valid roles to restore:`, validRoles);

          // Keep booster role if user has it
          const boosterRole = user.roles.cache.find(role => role.tags?.premiumSubscriberRole);
          if (boosterRole) {
            validRoles.push(boosterRole.id);
            console.log(`[UNJAIL DEBUG] Keeping booster role:`, boosterRole.id);
          }

          if (validRoles.length > 0) {
            // Set roles to the saved ones (this removes jail role and adds back the saved roles)
            await user.roles.set(validRoles, `Unjailed by ${message.author.tag}: ${reason}`);
          } else {
            // If no valid roles remain, just remove the jail role
            console.log(`[UNJAIL DEBUG] No valid roles found, just removing jail role`);
            await user.roles.remove(jailRole.id, `Unjailed by ${message.author.tag}: ${reason}`);
          }
        } else {
          // If no saved roles, just remove the jail role but keep booster role
          console.log(`[UNJAIL DEBUG] No saved roles found in database, just removing jail role`);
          
          // Keep booster role if user has it
          const boosterRole = user.roles.cache.find(role => role.tags?.premiumSubscriberRole);
          if (boosterRole) {
            await user.roles.set([boosterRole.id], `Unjailed by ${message.author.tag}: ${reason}`);
          } else {
            await user.roles.remove(jailRole.id, `Unjailed by ${message.author.tag}: ${reason}`);
          }
        }
      } catch (roleError) {
        if (roleError.code === 50013) {
          return embeds.deny(message, `I don't have permission to manage **${user.user.username}**'s roles. Please check my role hierarchy and permissions.`);
        }
        throw roleError; // Re-throw if it's not a permission error
      }

      // Remove saved roles from database using service layer
      // Find all role_save cases and remove them
      const allRoleCases = await guildService.getModerationHistory(message.guild.id, user.user.id, 'role_save');
      for (const roleCase of allRoleCases) {
        await guildService.removeModerationCase(message.guild.id, roleCase.caseId);
      }

      // Add to moderation history
      try {
        const { addModerationCase } = require('../../../database');
        await addModerationCase(
          message.guild.id,
          user.user.id,
          message.author.id,
          'unjail',
          reason
        );
      } catch (historyError) {
        // Don't fail the command if history logging fails
        console.log('Failed to log moderation case:', historyError.message);
      }

      // Clean up saved roles
      try {
        const { removeSavedUserRoles } = require('../../../database');
        await removeSavedUserRoles(message.guild.id, user.user.id);
      } catch (cleanupError) {
        console.log('Failed to clean up saved roles:', cleanupError.message);
      }

      // Send success message
      embeds.success(message, `**${user.user.username}** has been **unjailed** for ${reason}`);

      // Log the unjail action
      await logModerationAction('unjail', message.author, user.user, reason, message.guild);

    } catch (error) {
      logger.webhook.error(error, 'Unjail Command', {
        user: message.author,
        guild: message.guild,
        channel: message.channel,
        command: 'unjail',
        args: `${user.user.tag} - ${reason}`
      });
      
      embeds.deny(message, `An error occurred while unjailing **${user.user.username}**: ${error.message}`);
    }
  }
}

async function logModerationAction(action, executor, target, reason, guild) {
  try {
    const embed = webhookLogger.createModeratorLog({
      action: action,
      executor: executor,
      target: target,
      reason: reason,
      guild: guild
    });

    await webhookLogger.sendLog(guild.id, 'moderator', embed);
  } catch (error) {
    logger.webhook.error(error, 'Moderation Action Logging', {
      command: `${action} logging`,
      args: `Target: ${target?.tag || 'Unknown'}, Reason: ${reason}`,
      user: executor,
      guild: guild
    });
  }
}
