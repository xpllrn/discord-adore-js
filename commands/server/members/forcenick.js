const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { hasMultipleDiscordPermissions, checkSelfAction, checkBotAction, checkUserMemberHierarchy, checkBotMemberHierarchy } = require('../../../utils/permissions');

const { getService } = require('@services');
const { createPagination, createConfirmation } = require('../../../core/buttons');
const config = require('../../../config/setup');
const { findUser } = require('../../../handlers/finder');
const logger = require('../../../utils/logger');

module.exports = {
  name: "forcenick",
  aliases: ['fn'],
  description: `force a nickname on a user that will be automatically restored if they try to change it`,
  syntax: 'forcenick [user] (nickname)',
  example: 'forcenick @user NewNickname',
  permission: 'manage_guild_&_manage_nicknames',
  isGroupCommand: true,
  run: async (client, message, args) => {

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      return embeds.deny(message, 'I need **Manage Nicknames** permission to use this command');
    }

    // Get guild service
    const guildService = getService('guild');

    // Check if user provided input
    if (!args[0]) {
      return false;
    }

    // Handle list subcommand
    if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'List all forced nicknames',
        syntax: '{guildprefix}forcenick list',
        aliases: [],
        parameters: [],
        example: '{guildprefix}forcenick list'
      };

      try {
        const forcedNicks = await guildService.getAllForceNicks(message.guild.id);

        if (forcedNicks.length === 0) {
          return embeds.warn(message, 'No forced nicknames found in this server');
        }

        // Filter out users who are no longer in the server and get valid data
        const validForcedNicks = [];
        for (const forcedNick of forcedNicks) {
          const member = message.guild.members.cache.get(forcedNick.userId);
          if (member) {
            validForcedNicks.push({
              ...forcedNick,
              member: member
            });
          } else {
            // Clean up database - remove forced nicknames for users no longer in server
            await guildService.removeForceNick(message.guild.id, forcedNick.userId);
          }
        }

        if (validForcedNicks.length === 0) {
          return embeds.warn(message, 'No forced nicknames found for current server members');
        }

        if (validForcedNicks.length <= 10) {
          // Show simple embed for small lists
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
          // Use pagination for larger lists
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
      return;
    }

    // Handle reset subcommand
    if (args[0] === 'reset') {
      const subcommandInfo = {
        description: 'Remove all forced nicknames',
        syntax: '{guildprefix}forcenick reset',
        aliases: [],
        parameters: [],
        example: '{guildprefix}forcenick reset'
      };

      try {
        const forcedNicks = await guildService.getAllForceNicks(message.guild.id);

        if (forcedNicks.length === 0) {
          return embeds.warn(message, 'No forced nicknames found to reset');
        }

        // Show confirmation dialog
        await createConfirmation(
          message,
          `Are you sure you want to **remove all ${forcedNicks.length} forced nicknames**?`,
          async (interaction) => {
            // On approve: delete all forced nicknames using cache system
            await guildService.clearAllForceNicks(message.guild.id);

            // Edit the confirmation embed to show success message
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
      return;
    }

    // Use universal user finder
    const userResult = await findUser(message.guild, args[0], client);

    if (!userResult.found) {
      return embeds.warn(message, userResult.error);
    }

    // For forcenick, we need a guild member, not a global user
    if (userResult.isGlobal) {
      return embeds.warn(message, 'User is not in this server');
    }

    const member = userResult.user;
    const nickname = args.slice(1).join(" ");

    const subcommandInfo = {
      name: 'set',
      description: 'Force a nickname on a user or remove their forced nickname',
      syntax: '{guildprefix}forcenick [@user] [nickname]',
      aliases: [],
      parameters: ['user', 'nickname (optional)'],
      example: '{guildprefix}forcenick @user NewNickname'
    };

    if (!checkSelfAction(message, member, 'forcenick')) return;
    if (!checkBotAction(message, member)) return;

    // Hierarchy checks
    if (!checkUserMemberHierarchy(message, member)) return;
    if (!checkBotMemberHierarchy(message, member)) return;

    try {
      if (!nickname) {
        // Remove forced nickname using cache system
        const existingForcenick = await guildService.getForceNick(message.guild.id, member.user.id);

        if (!existingForcenick) {
          return embeds.warn(message, `**${member.user.tag}** doesn't have a forced nickname`);
        }

        await guildService.removeForceNick(message.guild.id, member.user.id);

        // Reset their actual nickname to default
        await member.setNickname(null, `Forced nickname removed by ${message.author.tag}`);

        return embeds.success(message, `Removed forced nickname for **${member.user.tag}** and reset their name`);

      } else {
        // Set forced nickname
        if (nickname.length > 32) {
          return embeds.warn(message, 'Nickname cannot be longer than 32 characters');
        }

        // Set the nickname first
        await member.setNickname(nickname, `Forced nickname by ${message.author.tag}`);

        // Save using cache system
        await guildService.setForceNick(message.guild.id, member.user.id, nickname, message.author.id);

        return embeds.success(message, `**${member.user.tag}** now has a forced nickname: **${nickname}**`);
      }

    } catch (error) {
      logger.both.error(error, message);
      return embeds.warn(message, 'An error occurred while setting the forced nickname.');
    }
  }
}
