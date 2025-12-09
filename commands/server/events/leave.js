const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const { EmbedVariableProcessor } = require('../../../utils/embeds/embedbuilder');
const config = require('../../../config/setup');
const { findChannel } = require('../../../handlers/finder');
const { getService } = require('@services');
const logger = require('../../../utils/logger');
const { runHelpCommand } = require('../../../utils/commandProcessor');

module.exports = {
  name: "leave",
  aliases: ['bye'],
  description: `Set up a leave message for when members leave`,
  syntax: 'leave [subcommand] (parameters)',
  example: 'leave add #general Goodbye {user.name}!',
  permission: "manage_guild",
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: [],
      description: 'Add or update a leave message for a channel',
      syntax: '{guildprefix}leave add [channel] [message] (--ping) (--self_destruct <seconds>)',
      parameters: ['channel', 'message', '--ping (optional)', '--self_destruct <seconds> (optional)'],
      example: '{guildprefix}leave add #general Goodbye {user.name}! --ping --self_destruct 5',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        let leavemessage = args.slice(1).join(' ');

        if (!channelInput || !leavemessage) return runHelpCommand(message, 'leave');

        // Parse options from the message
        const optionRegex = /--(ping|self_destruct)\s*(\d+)?/g;
        let pingEnabled = false;
        let selfDestruct = 0;
        let match;

        while ((match = optionRegex.exec(leavemessage)) !== null) {
          switch (match[1]) {
            case 'ping': pingEnabled = true; break;
            case 'self_destruct': selfDestruct = parseInt(match[2]) || 5; break;
          }
        }

        // Remove options from message
        leavemessage = leavemessage.replace(/--(ping|self_destruct)\s*(\d+)?/g, '').trim();

        if (!leavemessage) return runHelpCommand(message, 'leave');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const leavechannel = channelResult.channel;

        const currentLeaveMessages = await guildService.getLeaveMessages(message.guild.id) || [];
        const existingLeaveMessage = currentLeaveMessages.find(lm => lm.channelId === leavechannel.id);

        if (!existingLeaveMessage && currentLeaveMessages.length >= 5) {
          return embeds.deny(message, 'You have reached the **maximum leave messages (5)**. Please remove some first.');
        }

        try {
          await guildService.addLeaveMessage(message.guild.id, leavechannel.id, leavemessage, pingEnabled, selfDestruct);
          const action = existingLeaveMessage ? 'Updated the' : 'Created a';
          const options = [];
          if (pingEnabled) options.push('ping enabled');
          if (selfDestruct > 0) options.push(`self-destruct in ${selfDestruct}s`);
          const optionsStatus = options.length > 0 ? ` with **${options.join('**, **')}**` : '';
          return embeds.success(message, `${action} **leave message** for ${leavechannel}${optionsStatus}`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, `Failed to set leave message: ${error.message}`);
        }
      }
    },

    remove: {
      name: 'remove',
      aliases: [],
      description: 'Remove a leave message from a channel',
      syntax: '{guildprefix}leave remove [channel]',
      parameters: ['channel'],
      example: '{guildprefix}leave remove #general',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        if (!channelInput) return runHelpCommand(message, 'leave');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const leavechannel = channelResult.channel;

        const existingLeaveMessage = await guildService.getLeaveMessageForChannel(message.guild.id, leavechannel.id);
        if (!existingLeaveMessage) {
          return embeds.warn(message, `No **leave message** exists for ${leavechannel}`);
        }

        try {
          await guildService.removeLeaveMessage(message.guild.id, leavechannel.id);
          return embeds.success(message, `Removed the **leave message** for ${leavechannel}`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.error(message, `Failed to remove leave message: ${error.message}`);
        }
      }
    },

    view: {
      name: 'view',
      aliases: ['preview'],
      description: 'Preview the leave message for a channel',
      syntax: '{guildprefix}leave view [channel]',
      parameters: ['channel'],
      example: '{guildprefix}leave view #general',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        if (!channelInput) return runHelpCommand(message, 'leave');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const leavechannel = channelResult.channel;

        const existingLeaveMessage = await guildService.getLeaveMessageForChannel(message.guild.id, leavechannel.id);
        if (!existingLeaveMessage) {
          return embeds.warn(message, `No **leave message** to preview for ${leavechannel}`);
        }

        EmbedVariableProcessor.process(message.channel, existingLeaveMessage.message, {
          user: message.author,
          guild: message.guild,
          channel: leavechannel
        });
      }
    },

    variables: {
      name: 'variables',
      aliases: ['vars'],
      description: 'Shows available variables for leave messages',
      syntax: '{guildprefix}leave variables',
      parameters: [],
      example: '{guildprefix}leave variables',

      handler: async (client, message, args, guildService) => {
        const member = message.author;
        const ordinal = (message.guild.memberCount.toString().endsWith(1) && !message.guild.memberCount.toString().endsWith(11)) ? 'st' : (message.guild.memberCount.toString().endsWith(2) && !message.guild.memberCount.toString().endsWith(12)) ? 'nd' : (message.guild.memberCount.toString().endsWith(3) && !message.guild.memberCount.toString().endsWith(13)) ? 'rd' : 'th';

        const embed = new EmbedBuilder()
          .setColor(config.colors.info)
          .setTitle('Leave Message Variables')
          .setDescription(`\`{user.id}\` — ${member.id}\n\`{user.name}\` — ${member.username}\n\`{user.mention}\` — ${member}\n\`{user.tag}\` — ${member.tag}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\`{server.humanmembercount}\` — ${message.guild.memberCount + ordinal}`);

        return message.channel.send({ embeds: [embed] });
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'Lists all configured leave messages',
      syntax: '{guildprefix}leave list',
      parameters: [],
      example: '{guildprefix}leave list',

      handler: async (client, message, args, guildService) => {
        const leaveMessages = await guildService.getLeaveMessages(message.guild.id) || [];

        if (leaveMessages.length === 0) {
          return embeds.warn(message, 'No **leave messages** have been setup yet');
        }

        const messageList = leaveMessages.map((lm, index) => {
          const channel = message.guild.channels.cache.get(lm.channelId);
          const channelName = channel ? `<#${channel.id}>` : `Unknown Channel (${lm.channelId})`;
          const messageNumber = (index + 1).toString().padStart(2, '0');
          return `\`${messageNumber}\` ${channelName}`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle('Leave Messages')
          .setDescription(messageList)
          .setFooter({ text: `${leaveMessages.length} leave message${leaveMessages.length === 1 ? '' : 's'}` });

        return message.channel.send({ embeds: [embed] });
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');
    await ensureGuildData(message.guild.id);

    const sub = args[0]?.toLowerCase();
    if (!sub) return runHelpCommand(message, 'leave');

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'leave');
  }
};
