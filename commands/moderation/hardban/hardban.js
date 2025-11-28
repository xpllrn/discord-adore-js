const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { createPagination } = require('../../../core/buttons');
const { checkSelfAction, checkBotAction, checkUserMemberHierarchy, checkBotMemberHierarchy, checkDiscordActionable } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { colors } = require('../../../config/setup');
const { getService } = require('../../../database/services');
const { findUser } = require('../../../handlers/finder');
const webhookLogger = require('../../../utils/webhookLogger');
const logger = require('../../../utils/logger');

module.exports = {
  name: "hardban",
  aliases: [],
  description: 'permanently ban a user. only antinuke admins and server owner can remove hardbans',
  syntax: 'hardban [user/list] (reason)',
  example: 'hardban @vwsn raiding',
  permission: 'antinuke_admin',
  run: async(client, message, args) => {
    const guildService = getService('guild');
    const antinukeService = getService('antinuke');

    // Check if user is antinuke admin or server owner
    const isOwner = message.author.id === message.guild.ownerId;
    const isAntiNukeAdmin = await antinukeService.isAdmin(message.guild.id, message.author.id);

    if (!isOwner && !isAntiNukeAdmin) {
      return embeds.deny(message, 'Only **antinuke admins** and the **server owner** can use this command!');
    }

    // Check if user provided input
    if (!args[0]) {
      return runHelpCommand(message, 'hardban');
    }

    // Handle 'hardban list' subcommand
    if (args[0].toLowerCase() === 'list') {
      return await showHardbanList(client, message, guildService);
    }

    // Permission check for bot
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      return embeds.deny(message, 'I need **Ban Members** permission to use this command');
    }

    // Use universal user finder
    const userResult = await findUser(message.guild, args[0], client);

    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }

    const user = userResult.user;
    const isGlobalBan = userResult.isGlobal;

    let reason = args.slice(1).join(" ");
    if (!reason) reason = 'reasons';

    if (isGlobalBan) {
      // Hardban - user is not in server, ban by ID
      if (!checkSelfAction(message, user, 'hardban')) return;
      if (!checkBotAction(message, user)) return;

      try {
        // Add to hardban list first
        await guildService.addHardban(message.guild.id, user.id, message.author.id, reason);

        // Then ban from Discord
        await message.guild.members.ban(user.id, { reason: `[HARDBAN] ${reason} | By: ${message.author.tag}` });

        let caseNumber = null;
        try {
          const moderationCase = await guildService.addModerationCase(
            message.guild.id,
            user.id,
            message.author.id,
            'hardban',
            reason
          );
          caseNumber = moderationCase.caseId;
        } catch (historyError) {
          // Don't fail the command if history logging fails
        }

        embeds.success(message, `**${user.tag}** has been **hardbanned** for ${reason}`);

        // Log the hardban action
        await logModerationAction('hardban', message.author, user, reason, message.guild, caseNumber);
      } catch (error) {
        logger.webhook.error(error, 'Hardban Command', {
          user: message.author,
          guild: message.guild,
          channel: message.channel,
          command: 'hardban',
          args: `${user.tag} - ${reason}`
        });
        embeds.deny(message, 'An error occurred while trying to hardban this user.');
      }
    } else {
      // Regular hardban - user is in server
      if (!checkSelfAction(message, user.user, 'hardban')) return;
      if (!checkBotAction(message, user.user)) return;
      if (!checkUserMemberHierarchy(message, user)) return;
      if (!checkBotMemberHierarchy(message, user)) return;
      if (!checkDiscordActionable(message, user, 'ban')) return;

      try {
        // Add to hardban list first
        await guildService.addHardban(message.guild.id, user.user.id, message.author.id, reason);

        // Then ban from Discord
        await user.ban({ reason: `[HARDBAN] ${reason} | By: ${message.author.tag}` });

        let caseNumber = null;
        try {
          const moderationCase = await guildService.addModerationCase(
            message.guild.id,
            user.user.id,
            message.author.id,
            'hardban',
            reason
          );
          caseNumber = moderationCase.caseId;
        } catch (historyError) {
          // Don't fail the command if history logging fails
        }

        embeds.success(message, `**${user.user.username}** has been **hardbanned** for ${reason}`);

        // Log the hardban action
        await logModerationAction('hardban', message.author, user.user, reason, message.guild, caseNumber);
      } catch (error) {
        logger.webhook.error(error, 'Hardban Command', {
          user: message.author,
          guild: message.guild,
          channel: message.channel,
          command: 'hardban',
          args: `${user.user.tag} - ${reason}`
        });
        embeds.deny(message, 'An error occurred while trying to hardban this user.');
      }
    }
  }
}

async function showHardbanList(client, message, guildService) {
  try {
    const hardbans = await guildService.getAllHardbans(message.guild.id);

    if (!hardbans || hardbans.length === 0) {
      return embeds.warn(message, 'No hardbanned users found in this server');
    }

    if (hardbans.length > 50) {
      return embeds.warn(message, `There are too many hardbanned users (${hardbans.length}) to display`);
    }

    // If 10 or fewer hardbans, show without pagination
    if (hardbans.length <= 10) {
      const hardbanList = await Promise.all(hardbans.map(async (hardban, index) => {
        const num = String(index + 1).padStart(2, '0');
        
        // Try to fetch user info
        let userTag = hardban.userId;
        try {
          const user = await client.users.fetch(hardban.userId).catch(() => null);
          if (user) {
            userTag = user.username;
          }
        } catch (error) {
          // Use ID if fetch fails
        }

        const bannedDate = new Date(hardban.bannedAt);
        const dateStr = `<t:${Math.floor(bannedDate.getTime() / 1000)}:R>`;

        return `\`${num}\` **${userTag}** - ${hardban.reason} (${dateStr})`;
      }));

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${message.guild.name}'s Hardbans`)
        .setDescription(hardbanList.join('\n'))
        .setFooter({ text: `${hardbans.length} user${hardbans.length === 1 ? '' : 's'} hardbanned` });

      return message.channel.send({ embeds: [embed] });
    }

    // Use pagination for more than 10 hardbans
    const formatPage = async (pageItems, currentPage, totalPages) => {
      const startIndex = (currentPage - 1) * 10;
      
      const hardbanList = await Promise.all(pageItems.map(async (hardban, index) => {
        const num = String(startIndex + index + 1).padStart(2, '0');
        
        // Try to fetch user info
        let userTag = hardban.userId;
        try {
          const user = await client.users.fetch(hardban.userId).catch(() => null);
          if (user) {
            userTag = user.username;
          }
        } catch (error) {
          // Use ID if fetch fails
        }

        const bannedDate = new Date(hardban.bannedAt);
        const dateStr = `<t:${Math.floor(bannedDate.getTime() / 1000)}:R>`;

        return `\`${num}\` **${userTag}** - ${hardban.reason} (${dateStr})`;
      }));

      return new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${message.guild.name}'s Hardbans`)
        .setDescription(hardbanList.join('\n'))
        .setFooter({ text: `Page ${currentPage}/${totalPages} • ${hardbans.length} user${hardbans.length === 1 ? '' : 's'} hardbanned` });
    };

    return await createPagination(message, hardbans, formatPage, 10, `${message.guild.name}'s Hardbans`);
  } catch (error) {
    logger.webhook.error(error, 'Hardban List Command', {
      user: message.author,
      guild: message.guild,
      channel: message.channel,
      command: 'hardban list'
    });
    embeds.deny(message, 'An error occurred while fetching hardbans.');
  }
}

async function logModerationAction(action, executor, target, reason, guild, caseNumber = null) {
  try {
    const embed = webhookLogger.createModeratorLog({
      action: action,
      executor: executor,
      target: target,
      reason: reason,
      caseNumber: caseNumber,
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
