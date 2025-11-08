const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { hasDiscordPermission, checkSelfAction, checkBotAction, checkUserMemberHierarchy, checkBotMemberHierarchy, checkDiscordActionable, checkBotRoleHierarchy } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { createPagination } = require('../../../core/buttons');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { colors } = require('../../../config/setup');
const { findUser, findRole, findChannel } = require('../../../handlers/finder');
const webhookLogger = require('../../../utils/webhookLogger');
const logger = require('../../../utils/logger');
const { getService } = require('@services');

module.exports = {
  name: "jail",
  aliases: ['basement'],
  description: `jails the specified member or lists jailed users`,
  syntax: 'jail (user) (reason)',
  example: 'jail @vwsn spam',
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
      return runHelpCommand(message, 'jail');
    }

    // Handle 'jail list' subcommand
    if (args[0].toLowerCase() === 'list') {
      // Check if jail role exists using universal finder
      const jailRoleResult = findRole(message.guild, 'jailed');

      if (!jailRoleResult.found) {
        return embeds.deny(message, `Jail role not found! Please run \`,jailsetup\` first to set up the jail system.`);
      }

      const jailRole = jailRoleResult.role;

      // Get all jailed members
      const jailedMembers = message.guild.members.cache.filter(member => {
        return member.roles.cache.has(jailRole.id);
      });

      if (jailedMembers.size === 0) {
        return embeds.warn(message, `No members are currently jailed`);
      }

      if (jailedMembers.size > 50) {
        return embeds.warn(message, `There are too many jailed members (${jailedMembers.size}) to display`);
      }

      // Convert to array for pagination
      const jailedArray = Array.from(jailedMembers.values());

      // If 10 or fewer members, show without pagination
      if (jailedArray.length <= 10) {
        const jailedList = jailedArray.map((member, index) => {
          const num = String(index + 1).padStart(2, '0');
          return `\`${num}\` **${member.user.username}** (\`${member.user.id}\`)`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor(colors.embed)
          .setTitle(`${message.guild.name}'s Jail`)
          .setDescription(jailedList)
          .setFooter({ text: `${jailedArray.length} member${jailedArray.length === 1 ? '' : 's'} jailed` });

        return message.channel.send({ embeds: [embed] });
      }

      // Use pagination for more than 10 members
      const formatPage = (pageItems, currentPage, totalPages) => {
        const startIndex = (currentPage - 1) * 10;
        const jailedList = pageItems.map((member, index) => {
          const num = String(startIndex + index + 1).padStart(2, '0');
          return `\`${num}\` **${member.user.username}** (\`${member.user.id}\`)`;
        }).join('\n');

        return new EmbedBuilder()
          .setColor(colors.embed)
          .setTitle(`${message.guild.name}'s Jail`)
          .setDescription(jailedList)
          .setFooter({ text: `Page ${currentPage}/${totalPages} • ${jailedArray.length} member${jailedArray.length === 1 ? '' : 's'} jailed` });
      };

      return await createPagination(message, jailedArray, formatPage, 10, `${message.guild.name}'s Jail`);
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
    if (!checkSelfAction(message, user.user, 'jail')) return;

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

    // Check if jail channel exists using universal finder
    const jailChannelResult = findChannel(message.guild, 'jail');

    if (!jailChannelResult.found) {
      return embeds.deny(message, `Jail channel not found! Please run \`,jailsetup\` first to set up the jail system.`);
    }

    const jailChannel = jailChannelResult.channel;

    // Check if user is already jailed
    if (user.roles.cache.has(jailRole.id)) {
      return embeds.warn(message, `**${user.user.username}** is already jailed`);
    }

    try {
      // Save user's current roles (excluding @everyone, jailed role, and booster role)
      const rolesToSave = user.roles.cache
        .filter(role => {
          // Exclude @everyone
          if (role.id === message.guild.roles.everyone.id) return false;
          // Exclude jail role
          if (role.id === jailRole.id) return false;
          // Exclude booster role (premium subscriber role)
          if (role.tags?.premiumSubscriberRole) return false;
          return true;
        })
        .map(role => role.id);

      console.log(`[JAIL DEBUG] User: ${user.user.tag}, Roles to save:`, rolesToSave);

      // Save roles using database helper (with timeout protection)
      const { saveUserRoles } = require('../../../database');
      await saveUserRoles(message.guild.id, user.user.id, rolesToSave);
      
      console.log(`[JAIL DEBUG] Roles saved successfully`);

      // Get roles to keep (booster role if they have it)
      const rolesToKeep = [jailRole.id];
      const boosterRole = user.roles.cache.find(role => role.tags?.premiumSubscriberRole);
      if (boosterRole) {
        rolesToKeep.push(boosterRole.id);
      }

      // Remove all roles except @everyone, jail role, and booster role
      try {
        await user.roles.set(rolesToKeep, `Jailed by ${message.author.tag}: ${reason}`);
      } catch (roleError) {
        if (roleError.code === 50013) {
          return embeds.deny(message, `I don't have permission to manage **${user.user.username}**'s roles. Please check my role hierarchy and permissions.`);
        }
        throw roleError; // Re-throw if it's not a permission error
      }

      // Add to moderation history
      try {
        const { addModerationCase } = require('../../../database');
        await addModerationCase(
          message.guild.id,
          user.user.id,
          message.author.id,
          'jail',
          reason
        );
      } catch (historyError) {
        // Don't fail the command if history logging fails
        console.log('Failed to log moderation case:', historyError.message);
      }

      // Send success message
      embeds.success(message, `**${user.user.username}** has been **jailed** for ${reason}`);

      // Log the jail action
      await logModerationAction('jail', message.author, user.user, reason, message.guild);

      // Send embed message to jail channel
      const jailEmbed = new EmbedBuilder()
        .setColor('#2f3136')
        .setTitle('You are locked !')
        .setAuthor({ name: user.user.username, iconURL: user.user.displayAvatarURL() })
        .setFooter({ text: 'Please do not mention, let lead to increase in punishment' });

      let description = `> hey **${user.user.username}**, You are locked here by **${message.author.username}** because you probably did something stupid`;

      if (reason !== 'reasons') {
        description += `, maybe ${reason}..`;
      }

      jailEmbed.setDescription(description);

      await jailChannel.send({ content: `${user}`, embeds: [jailEmbed] });

    } catch (error) {
      logger.webhook.error(error, 'Jail Command', {
        user: message.author,
        guild: message.guild,
        channel: message.channel,
        command: 'jail',
        args: `${user.user.tag} - ${reason}`
      });
      
      embeds.deny(message, `An error occurred while jailing **${user.user.username}**: ${error.message}`);
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
