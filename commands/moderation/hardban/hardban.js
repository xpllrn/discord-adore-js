const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { checkSelfAction, checkBotAction, checkUserMemberHierarchy, checkBotMemberHierarchy, checkDiscordActionable } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { getService } = require('../../../database/services');
const { findUser } = require('../../../handlers/finder');
const webhookLogger = require('../../../utils/webhookLogger');
const logger = require('../../../utils/logger');

module.exports = {
  name: "hardban",
  aliases: [],
  description: 'Permanently ban a user. Only antinuke admins and server owner can remove hardbans.',
  syntax: 'hardban [user] (reason) | hardban list',
  example: 'hardban @vwsn raiding | hardban list',
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

    // Check for subcommands
    if (args[0] && args[0].toLowerCase() === 'list') {
      return await showHardbanList(client, message, guildService);
    }

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      return embeds.deny(message, 'I need **Ban Members** permission to use this command');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'hardban');
    }

    let reason = args.slice(1).join(" ");
    if (!reason) reason = 'No reason provided';

    const userResult = await findUser(message.guild, args[0], client);

    if (!userResult.found) {
      return embeds.deny(message, userResult.error);
    }

    const user = userResult.user;
    const isHardban = userResult.isGlobal;

    if (isHardban) {
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

        embeds.success(message, `**${user.tag}** has been **hardbanned** for ${reason}\n\n⚠️ This user can only be unbanned by antinuke admins or the server owner.`);

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
      if (!checkSelfAction(message, user, 'hardban')) return;
      if (!checkBotAction(message, user)) return;
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

        embeds.success(message, `**${user.user.tag}** has been **hardbanned** for ${reason}\n\n⚠️ This user can only be unbanned by antinuke admins or the server owner.`);

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
      return embeds.normal(message, 'No hardbanned users found in this server.');
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle(`Hardbanned Users - ${message.guild.name}`)
      .setDescription(`Total: **${hardbans.length}** hardbanned user${hardbans.length === 1 ? '' : 's'}`)
      .setTimestamp();

    // Add fields for each hardban (max 25 fields)
    const maxDisplay = Math.min(hardbans.length, 25);
    
    for (let i = 0; i < maxDisplay; i++) {
      const hardban = hardbans[i];
      
      // Try to fetch user info
      let userTag = hardban.userId;
      try {
        const user = await client.users.fetch(hardban.userId).catch(() => null);
        if (user) {
          userTag = user.tag;
        }
      } catch (error) {
        // Use ID if fetch fails
      }

      // Try to fetch banner info
      let bannerTag = hardban.bannedBy;
      try {
        const banner = await client.users.fetch(hardban.bannedBy).catch(() => null);
        if (banner) {
          bannerTag = banner.tag;
        }
      } catch (error) {
        // Use ID if fetch fails
      }

      const bannedDate = new Date(hardban.bannedAt);
      const dateStr = `<t:${Math.floor(bannedDate.getTime() / 1000)}:R>`;

      embed.addFields({
        name: `${i + 1}. ${userTag}`,
        value: `**Reason:** ${hardban.reason}\n**Banned by:** ${bannerTag}\n**Date:** ${dateStr}`,
        inline: false
      });
    }

    if (hardbans.length > 25) {
      embed.setFooter({ text: `Showing 25 of ${hardbans.length} hardbans` });
    }

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching hardbans:', error);
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
