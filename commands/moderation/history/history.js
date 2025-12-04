const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { createPagination } = require('../../../core/buttons');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { colors } = require('../../../config/setup');
const { getService } = require('../../../database/services');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "history",
  description: 'View and manage moderation history',
  syntax: 'history [user/subcommand] (parameters)',
  example: 'history @user',
  permission: 'manage_messages',
  isGroupCommand: true,

  subcommands: {
    view: {
      name: 'view',
      aliases: [],
      description: 'View a specific case',
      syntax: '{guildprefix}history view [caseid]',
      parameters: ['caseid'],
      example: '{guildprefix}history view 12',

      handler: async (client, message, args) => {
        const guildService = getService('guild');

        if (!args[0]) {
          return runHelpCommand(message, 'history');
        }

        const caseId = parseInt(args[0]);
        if (isNaN(caseId)) {
          return embeds.deny(message, 'Please provide a **valid case ID** number');
        }

        try {
          const moderationCase = await guildService.getModerationCase(message.guild.id, caseId);

          if (!moderationCase) {
            return embeds.deny(message, `Case #${caseId} not found`);
          }

          const targetUser = await client.users.fetch(moderationCase.userId).catch(() => null);
          const moderator = await client.users.fetch(moderationCase.moderatorId).catch(() => null);

          const timestamp = Math.floor(moderationCase.timestamp.getTime() / 1000);

          const embed = new EmbedBuilder()
            .setColor(colors.embed)
            .setTitle(`Case #${moderationCase.caseId} | ${moderationCase.action}`)
            .addFields(
              { name: 'User', value: targetUser ? `${targetUser.username} (\`${targetUser.id}\`)` : `Unknown User (\`${moderationCase.userId}\`)`, inline: true },
              { name: 'Moderator', value: moderator ? `${moderator.username} (\`${moderator.id}\`)` : `Unknown User (\`${moderationCase.moderatorId}\`)`, inline: true },
              { name: 'Timestamp', value: `<t:${timestamp}:F>`, inline: true },
              { name: 'Reason', value: moderationCase.reason, inline: false }
            );

          if (moderationCase.duration) {
            embed.addFields({ name: 'Duration', value: moderationCase.duration, inline: true });
          }

          return message.channel.send({ embeds: [embed] });

        } catch (error) {
          throw error;
        }
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete'],
      description: 'Remove a specific case from user history',
      syntax: '{guildprefix}history remove [user] [caseid]',
      parameters: ['user', 'caseid'],
      example: '{guildprefix}history remove @user 123',

      handler: async (client, message, args) => {
        const guildService = getService('guild');

        if (!args[0] || !args[1]) {
          return runHelpCommand(message, 'history');
        }

        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return;

        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found) {
          return embeds.deny(message, userResult.error);
        }
        if (userResult.isGlobal) {
          return embeds.deny(message, 'User is not in this server');
        }

        const caseId = parseInt(args[1]);
        if (isNaN(caseId)) {
          return embeds.deny(message, 'Please provide a valid case ID number');
        }

        try {
          const moderationCase = await guildService.getModerationCase(message.guild.id, caseId);

          if (!moderationCase) {
            return embeds.deny(message, `Case #${caseId} not found`);
          }

          if (moderationCase.userId !== userResult.user.user.id) {
            return embeds.deny(message, `Case #${caseId} does not belong to **${userResult.user.user.username}**`);
          }

          await guildService.removeModerationCase(message.guild.id, caseId);
          return embeds.success(message, `Removed case #${caseId} for **${userResult.user.user.username}**`);

        } catch (error) {
          throw error;
        }
      }
    },

    removeall: {
      name: 'removeall',
      aliases: ['clear'],
      description: 'Remove all cases from user history',
      syntax: '{guildprefix}history removeall [user]',
      parameters: ['user'],
      example: '{guildprefix}history removeall @user',

      handler: async (client, message, args) => {
        const guildService = getService('guild');

        if (!args[0]) {
          return runHelpCommand(message, 'history');
        }

        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return;

        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found) {
          return embeds.deny(message, userResult.error);
        }
        if (userResult.isGlobal) {
          return embeds.deny(message, 'User is not in this server');
        }

        try {
          const result = await guildService.removeAllModerationCases(message.guild.id, userResult.user.user.id);

          if (result.deletedCount === 0) {
            return embeds.warn(message, `**${userResult.user.user.username}** has no moderation history to remove`);
          }

          return embeds.success(message, `Removed **${result.deletedCount}** case${result.deletedCount === 1 ? '' : 's'} for **${userResult.user.user.username}**`);

        } catch (error) {
          throw error;
        }
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');

    if (!args[0]) {
      return runHelpCommand(message, 'history');
    }

    const sub = args[0]?.toLowerCase();

    // Check for subcommands first
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
    }

    // Check if first argument is an action type filter
    const actionTypes = ['warn', 'mute', 'kick', 'ban', 'jail', 'unmute', 'unban', 'unjail', 'warns', 'kicks', 'bans', 'mutes', 'jails'];
    
    if (actionTypes.includes(sub)) {
      if (!args[1]) {
        return runHelpCommand(message, 'history');
      }
      
      const userResult = await findUser(message.guild, args[1], client);
      if (!userResult.found) {
        return embeds.deny(message, userResult.error);
      }
      if (userResult.isGlobal) {
        return embeds.deny(message, 'User is not in this server');
      }

      const user = userResult.user;
      const actionFilter = sub;

      try {
        const moderationHistory = await guildService.getModerationHistory(message.guild.id, user.user.id, actionFilter);

        if (moderationHistory.length === 0) {
          return embeds.warn(message, `**${user.user.username}** has no ${actionFilter} moderation history`);
        }

        const formatPage = (pageItems, currentPage, totalPages) => {
          const historyList = pageItems.map((case_) => {
            const timestamp = Math.floor(case_.timestamp.getTime() / 1000);
            const moderator = message.guild.members.cache.get(case_.moderatorId);
            const moderatorName = moderator ? `${moderator.user.username}(${moderator.user.id})` : `Unknown User(${case_.moderatorId})`;

            return [
              `**case log #${case_.caseId} | ${case_.action}**`,
              `**Punished**: <t:${timestamp}:f>`,
              `**Moderator**: ${moderatorName}`,
              `**Reason**: ${case_.reason}`,
              ''
            ].join('\n');
          }).join('\n');

          return new EmbedBuilder()
            .setColor(colors.embed)
            .setTitle(`${actionFilter.charAt(0).toUpperCase() + actionFilter.slice(1)} history for ${user.user.username}`)
            .setDescription(historyList)
            .setFooter({ text: `Page ${currentPage}/${totalPages} • ${moderationHistory.length} case${moderationHistory.length === 1 ? '' : 's'} total` });
        };

        return await createPagination(message, moderationHistory, formatPage, 3, `${actionFilter} History for ${user.user.username}`);

      } catch (error) {
        throw error;
      }
    }

    // Default: treat first arg as user
    const userResult = await findUser(message.guild, args[0], client);
    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }
    if (userResult.isGlobal) {
      return embeds.deny(message, 'User is not in this server');
    }

    const user = userResult.user;
    const actionFilter = args[1] ? args[1].toLowerCase() : null;

    try {
      let moderationHistory;

      if (actionFilter && actionTypes.includes(actionFilter)) {
        moderationHistory = await guildService.getModerationHistory(message.guild.id, user.user.id, actionFilter);
      } else {
        moderationHistory = await guildService.getModerationHistory(message.guild.id, user.user.id);
      }

      if (moderationHistory.length === 0) {
        const filterText = actionFilter ? ` ${actionFilter}` : '';
        return embeds.warn(message, `**${user.user.username}** has no${filterText} moderation history`);
      }

      const formatPage = (pageItems, currentPage, totalPages) => {
        const historyList = pageItems.map((case_) => {
          const timestamp = Math.floor(case_.timestamp.getTime() / 1000);
          const moderator = message.guild.members.cache.get(case_.moderatorId);
          const moderatorName = moderator ? `${moderator.user.username}(${moderator.user.id})` : `Unknown User(${case_.moderatorId})`;

          return [
            `**case log #${case_.caseId} | ${case_.action}**`,
            `**Punished**: <t:${timestamp}:f>`,
            `**Moderator**: ${moderatorName}`,
            `**Reason**: ${case_.reason}`,
            ''
          ].join('\n');
        }).join('\n');

        const filterText = actionFilter ? ` ${actionFilter}` : '';
        return new EmbedBuilder()
          .setColor(colors.embed)
          .setTitle(`${filterText ? actionFilter.charAt(0).toUpperCase() + actionFilter.slice(1) : 'Moderation'} history for ${user.user.username}`)
          .setDescription(historyList)
          .setFooter({ text: `Page ${currentPage}/${totalPages} • ${moderationHistory.length} case${moderationHistory.length === 1 ? '' : 's'} total` });
      };

      await createPagination(message, moderationHistory, formatPage, 3, `History for ${user.user.username}`);

    } catch (error) {
      logger.webhook.error(error, message);
      if (error.message.includes('Database connection timeout') || error.message.includes('buffering timed out')) {
        embeds.deny(message, 'Database is still connecting. Please wait a moment and try again.');
      } else {
        throw error;
      }
    }
  }
};
