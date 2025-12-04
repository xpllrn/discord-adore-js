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
  aliases: ['hb', 'hackban'],
  description: 'Permanently ban a user from the server',
  syntax: 'hardban [user/list] (reason)',
  example: 'hardban @lami racist',
  permission: 'antinuke_admin',
  isGroupCommand: true,

  subcommands: {
    list: {
      name: 'list',
      aliases: [],
      description: 'List all hardbanned users',
      syntax: '{guildprefix}hardban list',
      parameters: [],
      example: '{guildprefix}hardban list',

      handler: async (client, message, args) => {
        const guildService = getService('guild');
        return await showHardbanList(client, message, guildService);
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');
    const antinukeService = getService('antinuke');

    const isOwner = message.author.id === message.guild.ownerId;
    const isAntiNukeAdmin = await antinukeService.isAdmin(message.guild.id, message.author.id);

    if (!isOwner && !isAntiNukeAdmin) {
      return embeds.deny(message, 'Only **antinuke admins** and the **server owner** can use this command!');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'hardban');
    }

    // Check for list subcommand
    const sub = args[0]?.toLowerCase();
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
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
        await guildService.addHardban(message.guild.id, user.id, message.author.id, reason);
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

        await webhookLogger.sendModeratorDM({
          target: user,
          action: 'hardban',
          executor: message.author,
          reason,
          guild: message.guild
        });

        await logModerationAction('hardban', message.author, user, reason, message.guild, caseNumber);
      } catch (error) {
        throw error;
      }
    } else {
      // Regular hardban - user is in server
      if (!checkSelfAction(message, user.user, 'hardban')) return;
      if (!checkBotAction(message, user.user)) return;
      if (!checkUserMemberHierarchy(message, user)) return;
      if (!checkBotMemberHierarchy(message, user)) return;
      if (!checkDiscordActionable(message, user, 'ban')) return;

      try {
        await guildService.addHardban(message.guild.id, user.user.id, message.author.id, reason);
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

        await webhookLogger.sendModeratorDM({
          target: user.user,
          action: 'hardban',
          executor: message.author,
          reason,
          guild: message.guild
        });

        await logModerationAction('hardban', message.author, user.user, reason, message.guild, caseNumber);
      } catch (error) {
        throw error;
      }
    }
  }
};

async function showHardbanList(client, message, guildService) {
  try {
    const hardbans = await guildService.getAllHardbans(message.guild.id);

    if (!hardbans || hardbans.length === 0) {
      return embeds.warn(message, 'No hardbanned users found in this server');
    }

    const formatPage = async (pageItems, currentPage, totalPages) => {
      const startIndex = (currentPage - 1) * 10;
      
      const hardbanList = await Promise.all(pageItems.map(async (hardban, index) => {
        const num = String(startIndex + index + 1).padStart(2, '0');
        
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
        .setFooter({ text: `${hardbans.length} hardbanned • page ${currentPage}/${totalPages}` });
    };

    return await createPagination(message, hardbans, formatPage, 10, `${message.guild.name}'s Hardbans`);
  } catch (error) {
    throw error;
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
    // Silent fail for moderation logging
  }
}
