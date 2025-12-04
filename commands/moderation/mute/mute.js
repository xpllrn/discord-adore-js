const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { hasDiscordPermission, checkSelfAction, checkBotAction, checkDiscordActionable } = require('../../../utils/permissions');
const { embeds } = require('../../../core/embeds');
const { createPagination } = require('../../../core/buttons');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { colors } = require('../../../config/setup');
const { getService } = require('../../../database/services');
const { findUser } = require('../../../handlers/finder');
const webhookLogger = require('../../../utils/webhookLogger');
const logger = require('../../../utils/logger');
const ms = require('ms');

module.exports = {
  name: "mute",
  aliases: ['shh', 'timeout', 'tu'],
  description: 'Timeout a user using Discord\'s built-in timeout feature',
  syntax: 'mute [user/list] (duration) (reason)',
  example: 'mute @vwsn 10m spam',
  permission: 'moderate_members',
  isGroupCommand: true,

  subcommands: {
    list: {
      name: 'list',
      aliases: [],
      description: 'List all currently timed out members',
      syntax: '{guildprefix}mute list',
      parameters: [],
      example: '{guildprefix}mute list',

      handler: async (client, message, args) => {
        return await showMuteList(message);
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');

    if (!await hasDiscordPermission(message, PermissionFlagsBits.ModerateMembers, 'Moderate Members')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return embeds.deny(message, 'I need **Moderate Members** permission to use this command');
    }

    if (!args[0]) {
      return runHelpCommand(message, 'mute');
    }

    // Check for list subcommand
    const sub = args[0]?.toLowerCase();
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
    }

    // Handle muting a user
    let userResult;
    try {
      userResult = await findUser(message.guild, args[0], client);
    } catch (error) {
      throw error;
    }

    if (!userResult || typeof userResult !== 'object' || !userResult.found) {
      return embeds.deny(message, userResult?.error);
    }

    if (userResult.isGlobal) {
      return embeds.deny(message, `I was unable to find a **user** in this server with the name: **${args[0]}**`);
    }

    const user = userResult.user;

    if (!checkSelfAction(message, user.user, 'mute')) return;
    if (!checkBotAction(message, user.user)) return;
    if (!checkDiscordActionable(message, user, 'timeout')) return;

    if (user.communicationDisabledUntil && user.communicationDisabledUntil > new Date()) {
      return embeds.warn(message, `**${user.user.username}** is already timed out`);
    }

    let duration = ms('5m');
    let reason = 'reasons';

    if (args[1]) {
      const parsedDuration = ms(args[1]);
      if (parsedDuration && parsedDuration > 0) {
        const maxTimeout = ms('28d');
        duration = Math.min(parsedDuration, maxTimeout);
        reason = args.slice(2).join(' ') || 'reasons';
      } else {
        reason = args.slice(1).join(' ');
      }
    }

    try {
      await user.timeout(duration, reason);

      embeds.success(message, `**${user.user.username}** has been **muted** for ${ms(duration, { long: true })} for ${reason}`);

      const until = new Date(Date.now() + duration);

      await webhookLogger.sendModeratorDM({
        target: user.user,
        action: 'mute',
        executor: message.author,
        reason,
        duration: ms(duration, { long: true }),
        until,
        guild: message.guild
      });

      Promise.allSettled([
        guildService.addModerationCase(
          message.guild.id,
          user.user.id,
          message.author.id,
          'mute',
          reason,
          ms(duration, { long: true })
        ),
        logModerationAction('timeout', message.author, user.user, reason, message.guild, ms(duration, { long: true }))
      ]).catch(() => {});

    } catch (error) {
      return embeds.deny(message, 'Failed to timeout user. Please check my permissions and role hierarchy.');
    }
  }
};

async function showMuteList(message) {
  try {
    await message.guild.members.fetch();

    const timedOutMembers = message.guild.members.cache.filter(member => {
      return member.communicationDisabledUntil && member.communicationDisabledUntil > new Date();
    });

    if (timedOutMembers.size === 0) {
      return embeds.warn(message, 'No members are currently timed out');
    }

    const timedOutArray = Array.from(timedOutMembers.values()).sort((a, b) => {
      return a.communicationDisabledUntil - b.communicationDisabledUntil;
    });

    if (timedOutArray.length <= 10) {
      const mutedList = timedOutArray.map((member, index) => {
        const num = String(index + 1).padStart(2, '0');
        const timeoutEnd = Math.floor(member.communicationDisabledUntil.getTime() / 1000);
        return `\`${num}\` **${member.user.username}** - Ends <t:${timeoutEnd}:R>`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${message.guild.name}'s Timed Out Members`)
        .setDescription(mutedList)
        .setFooter({ text: `${timedOutArray.length} member${timedOutArray.length === 1 ? '' : 's'} timed out` });

      return message.channel.send({ embeds: [embed] });
    }

    const formatPage = (pageItems, currentPage, totalPages) => {
      const startIndex = (currentPage - 1) * 10;
      const mutedList = pageItems.map((member, index) => {
        const num = String(startIndex + index + 1).padStart(2, '0');
        const timeoutEnd = Math.floor(member.communicationDisabledUntil.getTime() / 1000);
        return `\`${num}\` **${member.user.username}** - Ends <t:${timeoutEnd}:R>`;
      }).join('\n');

      return new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`${message.guild.name}'s Timed Out Members`)
        .setDescription(mutedList)
        .setFooter({ text: `Page ${currentPage}/${totalPages} • ${timedOutArray.length} member${timedOutArray.length === 1 ? '' : 's'} timed out` });
    };

    return await createPagination(message, timedOutArray, formatPage, 10, `${message.guild.name}'s Timed Out Members`);

  } catch (error) {
    throw error;
  }
}

async function logModerationAction(action, executor, target, reason, guild, duration = null) {
  try {
    const embed = webhookLogger.createModeratorLog({
      action: action,
      executor: executor,
      target: target,
      reason: reason,
      duration: duration,
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
