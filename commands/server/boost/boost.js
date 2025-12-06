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
      syntax: '{guildprefix}boost add [channel] [message] (--ping)',
      parameters: ['channel', 'message', '--ping (optional)'],
      example: '{guildprefix}boost add #boosts Thanks for boosting {user.mention}! --ping',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        let boostmessage = args.slice(1).join(' ');

        if (!channelInput || !boostmessage) return runHelpCommand(message, 'boost');

        // Check for --ping flag at the end
        const pingEnabled = boostmessage.trim().endsWith('--ping');
        if (pingEnabled) {
          boostmessage = boostmessage.slice(0, -6).trim();
        }

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) return runHelpCommand(message, 'boost');

        const boostchannel = channelResult.channel;

        const currentBoostMessages = await guildService.getBoostMessages(message.guild.id) || [];
        const existingBoostMessage = currentBoostMessages.find(bm => bm.channelId === boostchannel.id);

        if (!existingBoostMessage && currentBoostMessages.length >= 5) {
          return embeds.deny(message, 'You have reached the **maximum boost messages (5)**. Please remove some first.');
        }

        try {
          await guildService.addBoostMessage(message.guild.id, boostchannel.id, boostmessage, pingEnabled);
          const action = existingBoostMessage ? 'Updated the' : 'Created a';
          const pingStatus = pingEnabled ? ' with **ping enabled**' : '';
          return embeds.success(message, `${action} **boost message** for ${boostchannel}${pingStatus}`);
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
          return embeds.deny(message, 'I do **not have permission** to manage that role');
        }

        await guildService.setBoostRole(message.guild.id, boostRole.id);
        return embeds.success(message, `Set **${boostRole.name}** as the boost award role`);
      }
    },

    'award view': {
      name: 'award view',
      aliases: ['awardview'],
      description: 'View the current boost award role',
      syntax: '{guildprefix}boost award view',
      parameters: [],
      example: '{guildprefix}boost award view',

      handler: async (client, message, args, guildService) => {
        const boostRoleId = await guildService.getBoostRole(message.guild.id);
        if (!boostRoleId) {
          return embeds.warn(message, 'No **boost award role** has been set');
        }

        const boostRole = message.guild.roles.cache.get(boostRoleId);
        if (!boostRole) {
          await guildService.removeBoostRole(message.guild.id);
          return embeds.warn(message, 'The configured boost award role no longer exists and has been removed');
        }

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle('Boost Award Role')
          .setDescription(`Current boost award role: ${boostRole}\n\nMembers who boost the server will automatically receive this role.`)
          .setFooter({ text: 'Use "boost award none" to remove' });

        return message.channel.send({ embeds: [embed] });
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

    // Check for two-word subcommands first (e.g., "award view")
    const twoWordSub = args.slice(0, 2).join(' ').toLowerCase();
    const twoWordSubcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === twoWordSub || s.aliases.includes(twoWordSub));

    if (twoWordSubcommand) {
      return twoWordSubcommand.handler(client, message, args.slice(2), guildService);
    }

    // Check for single-word subcommands
    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'boost');
  }
};
