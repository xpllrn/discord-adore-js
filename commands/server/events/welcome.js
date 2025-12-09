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
  name: "welcome",
  aliases: ['welc'],
  description: `Set up a welcome message for when new members join`,
  syntax: 'welcome [subcommand] (parameters)',
  example: 'welcome add #general Welcome {user.mention}!',
  permission: "manage_guild",
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: [],
      description: 'Add or update a welcome message for a channel',
      syntax: '{guildprefix}welcome add [channel] [message] (--ping) (--self_destruct <seconds>)',
      parameters: ['channel', 'message', '--ping (optional)', '--self_destruct <seconds> (optional)'],
      example: '{guildprefix}welcome add #general Welcome {user.mention}! --ping --self_destruct 5',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        let welcomemessage = args.slice(1).join(' ');

        if (!channelInput || !welcomemessage) return runHelpCommand(message, 'welcome');

        // Parse options from the message
        const optionRegex = /--(ping|self_destruct)\s*(\d+)?/g;
        let pingEnabled = false;
        let selfDestruct = 0;
        let match;

        while ((match = optionRegex.exec(welcomemessage)) !== null) {
          switch (match[1]) {
            case 'ping': pingEnabled = true; break;
            case 'self_destruct': selfDestruct = parseInt(match[2]) || 5; break;
          }
        }

        // Remove options from message
        welcomemessage = welcomemessage.replace(/--(ping|self_destruct)\s*(\d+)?/g, '').trim();

        if (!welcomemessage) return runHelpCommand(message, 'welcome');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const welcomechannel = channelResult.channel;

        const currentWelcomeMessages = await guildService.getWelcomeMessages(message.guild.id) || [];
        const existingWelcomeMessage = currentWelcomeMessages.find(wm => wm.channelId === welcomechannel.id);

        if (!existingWelcomeMessage && currentWelcomeMessages.length >= 5) {
          return embeds.deny(message, 'You have reached the **maximum welcome messages (5)**. Please remove some first.');
        }

        try {
          await guildService.addWelcomeMessage(message.guild.id, welcomechannel.id, welcomemessage, pingEnabled, selfDestruct);
          const action = existingWelcomeMessage ? 'Updated the' : 'Created a';
          const options = [];
          if (pingEnabled) options.push('ping enabled');
          if (selfDestruct > 0) options.push(`self-destruct in ${selfDestruct}s`);
          const optionsStatus = options.length > 0 ? ` with **${options.join('**, **')}**` : '';
          return embeds.success(message, `${action} **welcome message** for ${welcomechannel}${optionsStatus}`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, `Failed to set welcome message: ${error.message}`);
        }
      }
    },

    remove: {
      name: 'remove',
      aliases: [],
      description: 'Remove a welcome message from a channel',
      syntax: '{guildprefix}welcome remove [channel]',
      parameters: ['channel'],
      example: '{guildprefix}welcome remove #general',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        if (!channelInput) return runHelpCommand(message, 'welcome');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const welcomechannel = channelResult.channel;

        const existingWelcomeMessage = await guildService.getWelcomeMessageForChannel(message.guild.id, welcomechannel.id);
        if (!existingWelcomeMessage) {
          return embeds.warn(message, `No **welcome message** exists for ${welcomechannel}`);
        }

        await guildService.removeWelcomeMessage(message.guild.id, welcomechannel.id);
        return embeds.success(message, `Removed the **welcome message** for ${welcomechannel}`);
      }
    },

    view: {
      name: 'view',
      aliases: ['preview'],
      description: 'Preview the welcome message for a channel',
      syntax: '{guildprefix}welcome view [channel]',
      parameters: ['channel'],
      example: '{guildprefix}welcome view #general',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        if (!channelInput) return runHelpCommand(message, 'welcome');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const welcomechannel = channelResult.channel;

        const existingWelcomeMessage = await guildService.getWelcomeMessageForChannel(message.guild.id, welcomechannel.id);
        if (!existingWelcomeMessage) {
          return embeds.warn(message, `No **welcome message** to preview for ${welcomechannel}`);
        }

        EmbedVariableProcessor.process(message.channel, existingWelcomeMessage.message, {
          user: message.author,
          guild: message.guild,
          channel: welcomechannel
        });
      }
    },

    variables: {
      name: 'variables',
      aliases: ['vars'],
      description: 'Shows available variables for welcome messages',
      syntax: '{guildprefix}welcome variables',
      parameters: [],
      example: '{guildprefix}welcome variables',

      handler: async (client, message, args, guildService) => {
        const member = message.author;
        const ordinal = (message.guild.memberCount.toString().endsWith(1) && !message.guild.memberCount.toString().endsWith(11)) ? 'st' : (message.guild.memberCount.toString().endsWith(2) && !message.guild.memberCount.toString().endsWith(12)) ? 'nd' : (message.guild.memberCount.toString().endsWith(3) && !message.guild.memberCount.toString().endsWith(13)) ? 'rd' : 'th';

        const embed = new EmbedBuilder()
          .setColor(config.colors.info)
          .setTitle('Welcome Message Variables')
          .setDescription(`\`{user.id}\` — ${member.id}\n\`{user.name}\` — ${member.username}\n\`{user.mention}\` — ${member}\n\`{user.tag}\` — ${member.tag}\n\`{server.name}\` — ${message.guild.name}\n\`{server.membercount}\` — ${message.guild.memberCount}\n\`{server.humanmembercount}\` — ${message.guild.memberCount + ordinal}`);

        return message.channel.send({ embeds: [embed] });
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'Lists all configured welcome messages',
      syntax: '{guildprefix}welcome list',
      parameters: [],
      example: '{guildprefix}welcome list',

      handler: async (client, message, args, guildService) => {
        const welcomeMessages = await guildService.getWelcomeMessages(message.guild.id) || [];

        if (welcomeMessages.length === 0) {
          return embeds.warn(message, 'No **welcome messages** have been setup yet');
        }

        const messageList = welcomeMessages.map((wm, index) => {
          const channel = message.guild.channels.cache.get(wm.channelId);
          const channelName = channel ? `<#${channel.id}>` : `Unknown Channel (${wm.channelId})`;
          const messageNumber = (index + 1).toString().padStart(2, '0');
          return `\`${messageNumber}\` ${channelName}`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle('Welcome Messages')
          .setDescription(messageList)
          .setFooter({ text: `${welcomeMessages.length} welcome message${welcomeMessages.length === 1 ? '' : 's'}` });

        return message.channel.send({ embeds: [embed] });
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');
    await ensureGuildData(message.guild.id);

    const sub = args[0]?.toLowerCase();
    if (!sub) return runHelpCommand(message, 'welcome');

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'welcome');
  }
};
