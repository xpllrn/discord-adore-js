const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const { EmbedVariableProcessor } = require('../../../utils/embeds/embedbuilder');
const config = require('../../../config/setup');
const { findChannel, findRole } = require('../../../handlers/finder');
const { getService } = require('@services');
const logger = require('../../../utils/logger');
const { runHelpCommand } = require('../../../utils/commandProcessor');

module.exports = {
  name: "boost",
  aliases: ['boosts'],
  description: `Set up a boost message and role for when members boost the server`,
  syntax: 'boost [subcommand] (parameters)',
  example: 'boost add #boosts Thanks for boosting {user.mention}!',
  permission: "manage_guild",
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: [],
      description: 'Add or update a boost message for a channel',
      syntax: '{guildprefix}boost add [channel] [message]',
      parameters: ['channel', 'message'],
      example: '{guildprefix}boost add #boosts Thanks for boosting {user.mention}!',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        const boostmessage = args.slice(1).join(' ');

        if (!channelInput || !boostmessage) return runHelpCommand(message, 'boost');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) return runHelpCommand(message, 'boost');

        const boostchannel = channelResult.channel;

        const currentBoostMessages = await guildService.getBoostMessages(message.guild.id) || [];
        const existingBoostMessage = currentBoostMessages.find(bm => bm.channelId === boostchannel.id);

        if (!existingBoostMessage && currentBoostMessages.length >= 5) {
          return embeds.deny(message, 'You have reached the **maximum boost messages (5)**. Please remove some first.');
        }

        try {
          await guildService.addBoostMessage(message.guild.id, boostchannel.id, boostmessage);
          const action = existingBoostMessage ? 'Updated the' : 'Created a';
          return embeds.success(message, `${action} **boost message** for ${boostchannel}`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, `Failed to set boost message: ${error.message}`);
        }
      }
    },

    remove: {
      name: 'remove',
      aliases: [],
      description: 'Remove a boost message from a channel',
      syntax: '{guildprefix}boost remove [channel]',
      parameters: ['channel'],
      example: '{guildprefix}boost remove #boosts',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        if (!channelInput) return runHelpCommand(message, 'boost');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) return runHelpCommand(message, 'boost');

        const boostchannel = channelResult.channel;

        const existingBoostMessage = await guildService.getBoostMessage(message.guild.id, boostchannel.id);
        if (!existingBoostMessage) {
          return embeds.warn(message, `No **boost message** exists for ${boostchannel}`);
        }

        try {
          await guildService.removeBoostMessage(message.guild.id, boostchannel.id);
          return embeds.success(message, `Removed the **boost message** for ${boostchannel}`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, `Failed to remove boost message: ${error.message}`);
        }
      }
    },

    view: {
      name: 'view',
      aliases: ['preview'],
      description: 'Preview the boost message for a channel',
      syntax: '{guildprefix}boost view [channel]',
      parameters: ['channel'],
      example: '{guildprefix}boost view #boosts',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        if (!channelInput) return runHelpCommand(message, 'boost');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) return runHelpCommand(message, 'boost');

        const boostchannel = channelResult.channel;

        const existingBoostMessage = await guildService.getBoostMessage(message.guild.id, boostchannel.id);
        if (!existingBoostMessage) {
          return embeds.warn(message, `No **boost message** to preview for ${boostchannel}`);
        }

        EmbedVariableProcessor.process(message.channel, existingBoostMessage.message, {
          user: message.author,
          guild: message.guild,
          channel: boostchannel
        });
      }
    },

    variables: {
      name: 'variables',
      aliases: ['vars'],
      description: 'Shows available variables for boost messages',
      syntax: '{guildprefix}boost variables',
      parameters: [],
      example: '{guildprefix}boost variables',

      handler: async (client, message, args, guildService) => {
        const member = message.author;
        const ordinal = (message.guild.memberCount.toString().endsWith(1) && !message.guild.memberCount.toString().endsWith(11)) ? 'st' : (message.guild.memberCount.toString().endsWith(2) && !message.guild.memberCount.toString().endsWith(12)) ? 'nd' : (message.guild.memberCount.toString().endsWith(3) && !message.guild.memberCount.toString().endsWith(13)) ? 'rd' : 'th';

        const embed = new EmbedBuilder()
          .setColor(config.colors.info)
          .setTitle('Boost Message Variables')
          .setDescription(`\`{user.id}\` — ${member.id}\n\`{user.name}\` — ${member.username}\n\`{user.mention}\` — ${member}\n\`{user.tag}\` — ${member.tag}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\`{server.humanmembercount}\` — ${message.guild.memberCount + ordinal}\n\`{server.boostcount}\` — ${message.guild.premiumSubscriptionCount}\n\`{server.boostlevel}\` — ${message.guild.premiumTier}`);

        return message.channel.send({ embeds: [embed] });
      }
    },

    award: {
      name: 'award',
      aliases: ['role'],
      description: 'Set or remove the boost award role',
      syntax: '{guildprefix}boost award [@role/none]',
      parameters: ['role'],
      example: '{guildprefix}boost award @Booster',

      handler: async (client, message, args, guildService) => {
        const roleInput = args[0];
        if (!roleInput) return runHelpCommand(message, 'boost');

        if (roleInput.toLowerCase() === 'none') {
          await guildService.removeBoostRole(message.guild.id);
          return embeds.success(message, 'Removed the **boost award role**');
        }

        const roleResult = findRole(message.guild, roleInput);
        if (!roleResult.found) {
          return embeds.deny(message, roleResult.error);
        }

        const boostRole = roleResult.role;

        if (boostRole.position >= message.guild.members.me.roles.highest.position) {
          return embeds.deny(message, 'I cannot manage that role as it is higher than or equal to my highest role');
        }

        if (!boostRole.editable) {
          return embeds.deny(message, 'I do not have permission to manage that role');
        }

        await guildService.setBoostRole(message.guild.id, boostRole.id);
        return embeds.success(message, `Set **${boostRole.name}** as the boost award role`);
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'Lists all configured boost messages',
      syntax: '{guildprefix}boost list',
      parameters: [],
      example: '{guildprefix}boost list',

      handler: async (client, message, args, guildService) => {
        const boostMessages = await guildService.getBoostMessages(message.guild.id) || [];

        if (boostMessages.length === 0) {
          return embeds.warn(message, 'No **boost messages** have been setup yet');
        }

        const messageList = boostMessages.map((bm, index) => {
          const channel = message.guild.channels.cache.get(bm.channelId);
          const channelName = channel ? `<#${channel.id}>` : `Unknown Channel (${bm.channelId})`;
          const messageNumber = (index + 1).toString().padStart(2, '0');
          return `\`${messageNumber}\` ${channelName}`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle('Boost Messages')
          .setDescription(messageList)
          .setFooter({ text: `${boostMessages.length} boost message${boostMessages.length === 1 ? '' : 's'}` });

        return message.channel.send({ embeds: [embed] });
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');
    await ensureGuildData(message.guild.id);

    const sub = args[0]?.toLowerCase();
    if (!sub) return runHelpCommand(message, 'boost');

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'boost');
  }
};
