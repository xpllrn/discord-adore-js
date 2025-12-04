const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { hasMultipleDiscordPermissions, checkSelfAction, checkBotAction, checkUserMemberHierarchy, checkBotMemberHierarchy } = require('../../../utils/permissions');
const { getService } = require('@services');
const { createPagination, createConfirmation } = require('../../../core/buttons');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const config = require('../../../config/setup');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "forcenick",
  aliases: ['fn'],
  description: `force a nickname on a user that will be automatically restored if they try to change it`,
  syntax: 'forcenick [subcommand/user] (nickname)',
  example: 'forcenick @user NewNickname',
  permission: 'manage_guild_&_manage_nicknames',
  isGroupCommand: true,

  subcommands: {
    set: {
      name: 'set',
      aliases: [],
      description: 'Force a nickname on a user or remove their forced nickname',
      syntax: '{guildprefix}forcenick [@user] [nickname]',
      parameters: ['user', 'nickname (optional)'],
      example: '{guildprefix}forcenick @user NewNickname',

      handler: async (client, message, args, guildService) => {
        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found) return embeds.warn(message, userResult.error);
        if (userResult.isGlobal) return embeds.warn(message, 'User is not in this server');

        const member = userResult.user;
        const nickname = args.slice(1).join(" ");

        if (!checkSelfAction(message, member, 'forcenick')) return;
        if (!checkBotAction(message, member)) return;
        if (!checkUserMemberHierarchy(message, member)) return;
        if (!checkBotMemberHierarchy(message, member)) return;

        try {
          if (!nickname) {
            const existingForcenick = await guildService.getForceNick(message.guild.id, member.user.id);
            if (!existingForcenick) {
              return embeds.warn(message, `**${member.user.tag}** doesn't have a forced nickname`);
            }

            await guildService.removeForceNick(message.guild.id, member.user.id);
            await member.setNickname(null, `Forced nickname removed by ${message.author.tag}`);
            return embeds.success(message, `Removed forced nickname for **${member.user.tag}** and reset their name`);
          } else {
            if (nickname.length > 32) {
              return embeds.warn(message, 'Nickname cannot be longer than 32 characters');
            }

            await member.setNickname(nickname, `Forced nickname by ${message.author.tag}`);
            await guildService.setForceNick(message.guild.id, member.user.id, nickname, message.author.id);
            return embeds.success(message, `**${member.user.tag}** now has a forced nickname: **${nickname}**`);
          }
        } catch (error) {
          logger.both.error(error, message);
          return embeds.warn(message, 'An error occurred while setting the forced nickname.');
        }
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'List all forced nicknames',
      syntax: '{guildprefix}forcenick list',
      parameters: [],
      example: '{guildprefix}forcenick list',

      handler: async (client, message, args, guildService) => {
        try {
          const forcedNicks = await guildService.getAllForceNicks(message.guild.id);

          if (forcedNicks.length === 0) {
            return embeds.warn(message, 'No forced nicknames found in this server');
          }

          const validForcedNicks = [];
          for (const forcedNick of forcedNicks) {
            const member = message.guild.members.cache.get(forcedNick.userId);
            if (member) {
              validForcedNicks.push({ ...forcedNick, member: member });
            } else {
              await guildService.removeForceNick(message.guild.id, forcedNick.userId);
            }
          }

          if (validForcedNicks.length === 0) {
            return embeds.warn(message, 'No forced nicknames found for current server members');
          }

          if (validForcedNicks.length <= 10) {
            const forcedNickList = validForcedNicks.map((forcedNick, index) => {
              const number = (index + 1).toString().padStart(2, '0');
              const setBy = message.guild.members.cache.get(forcedNick.setBy);
              const setByText = setBy ? setBy.user.tag : 'Unknown User';
              return `\`${number}\` **${forcedNick.member.user.tag}** → **${forcedNick.nickname}**\n    Set by: ${setByText}`;
            }).join('\n\n');

            const embed = new EmbedBuilder()
              .setColor(config.colors.embed)
              .setTitle('Forced Nicknames')
              .setDescription(forcedNickList)
              .setFooter({ text: `${validForcedNicks.length} forced nicknames` });

            return message.channel.send({ embeds: [embed] });
          } else {
            const formatPage = (pageForcedNicks, currentPage, totalPages) => {
              const startIndex = (currentPage - 1) * 10;
              const forcedNickList = pageForcedNicks.map((forcedNick, index) => {
                const number = (startIndex + index + 1).toString().padStart(2, '0');
                const setBy = message.guild.members.cache.get(forcedNick.setBy);
                const setByText = setBy ? setBy.user.tag : 'Unknown User';
                return `\`${number}\` **${forcedNick.member.user.tag}** → **${forcedNick.nickname}**\n    Set by: ${setByText}`;
              }).join('\n\n');

              return new EmbedBuilder()
                .setColor(config.colors.embed)
                .setTitle('Forced Nicknames')
                .setDescription(forcedNickList)
                .setFooter({ text: `${validForcedNicks.length} forced nicknames • Page ${currentPage}/${totalPages}` });
            };

            await createPagination(message, validForcedNicks, formatPage, 10, 'Forced Nicknames');
          }
        } catch (error) {
          logger.both.error(error, message);
          return embeds.warn(message, 'An error occurred while fetching forced nicknames.');
        }
      }
    },

    reset: {
      name: 'reset',
      aliases: ['clear'],
      description: 'Remove all forced nicknames',
      syntax: '{guildprefix}forcenick reset',
      parameters: [],
      example: '{guildprefix}forcenick reset',

      handler: async (client, message, args, guildService) => {
        try {
          const forcedNicks = await guildService.getAllForceNicks(message.guild.id);

          if (forcedNicks.length === 0) {
            return embeds.warn(message, 'No forced nicknames found to reset');
          }

          await createConfirmation(
            message,
            `Are you sure you want to **remove all ${forcedNicks.length} forced nicknames**?`,
            async (interaction) => {
              await guildService.clearAllForceNicks(message.guild.id);

              const successEmbed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setDescription(`✅ <@${message.author.id}>: Removed all forced nicknames`);

              await interaction.editReply({ embeds: [successEmbed], components: [] });
            }
          );
        } catch (error) {
          logger.both.error(error, message);
          return embeds.warn(message, 'An error occurred while resetting forced nicknames.');
        }
      }
    }
  },

  run: async (client, message, args) => {
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      return embeds.deny(message, 'I need **Manage Nicknames** permission to use this command');
    }

    const guildService = getService('guild');

    if (!args[0]) return runHelpCommand(message, 'forcenick');

    const sub = args[0].toLowerCase();

    // Check for subcommands first
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    // If not a subcommand, treat as user input for set command
    return module.exports.subcommands.set.handler(client, message, args, guildService);
  }
};
