const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const config = require('../../../config/setup');
const { findChannel } = require('../../../handlers/finder');
const { getService } = require('@services');
const logger = require('../../../utils/logger');
const { runHelpCommand } = require('../../../utils/commandProcessor');

module.exports = {
  name: "poj",
  aliases: ['pingonjoin'],
  description: `Ping new members in specified channels when they join (ping is deleted immediately)`,
  syntax: 'poj [subcommand] (parameters)',
  example: 'poj add #general',
  permission: "manage_guild",
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: [],
      description: 'Add a channel to ping new members in',
      syntax: '{guildprefix}poj add [channel]',
      parameters: ['channel'],
      example: '{guildprefix}poj add #general',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        if (!channelInput) return runHelpCommand(message, 'poj');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const pojChannel = channelResult.channel;

        const currentPojChannels = await guildService.getPingOnJoinChannels(message.guild.id) || [];
        const existingPoj = currentPojChannels.find(p => p.channelId === pojChannel.id);

        if (!existingPoj && currentPojChannels.length >= 5) {
          return embeds.deny(message, 'You have reached the **maximum ping on join channels (5)**. Please remove some first.');
        }

        try {
          await guildService.addPingOnJoin(message.guild.id, pojChannel.id);
          const action = existingPoj ? 'Updated' : 'Added';
          return embeds.success(message, `${action} **ping on join** for ${pojChannel}`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, `Failed to set ping on join: ${error.message}`);
        }
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete'],
      description: 'Remove a channel from ping on join',
      syntax: '{guildprefix}poj remove [channel]',
      parameters: ['channel'],
      example: '{guildprefix}poj remove #general',

      handler: async (client, message, args, guildService) => {
        const channelInput = args[0];
        if (!channelInput) return runHelpCommand(message, 'poj');

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        const pojChannel = channelResult.channel;

        const currentPojChannels = await guildService.getPingOnJoinChannels(message.guild.id) || [];
        const existingPoj = currentPojChannels.find(p => p.channelId === pojChannel.id);

        if (!existingPoj) {
          return embeds.warn(message, `No **ping on join** exists for ${pojChannel}`);
        }

        try {
          await guildService.removePingOnJoin(message.guild.id, pojChannel.id);
          return embeds.success(message, `Removed **ping on join** for ${pojChannel}`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, `Failed to remove ping on join: ${error.message}`);
        }
      }
    },

    list: {
      name: 'list',
      aliases: [],
      description: 'Lists all configured ping on join channels',
      syntax: '{guildprefix}poj list',
      parameters: [],
      example: '{guildprefix}poj list',

      handler: async (client, message, args, guildService) => {
        const pojChannels = await guildService.getPingOnJoinChannels(message.guild.id) || [];

        if (pojChannels.length === 0) {
          return embeds.warn(message, 'No **ping on join** channels have been setup yet');
        }

        const channelList = pojChannels.map((p, index) => {
          const channel = message.guild.channels.cache.get(p.channelId);
          const channelName = channel ? `<#${channel.id}>` : `Unknown Channel (${p.channelId})`;
          const messageNumber = (index + 1).toString().padStart(2, '0');
          return `\`${messageNumber}\` ${channelName}`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle('Ping on Join Channels')
          .setDescription(channelList)
          .setFooter({ text: `${pojChannels.length} channel${pojChannels.length === 1 ? '' : 's'}` });

        return message.channel.send({ embeds: [embed] });
      }
    },

    reset: {
      name: 'reset',
      aliases: ['clear'],
      description: 'Remove all ping on join channels',
      syntax: '{guildprefix}poj reset',
      parameters: [],
      example: '{guildprefix}poj reset',

      handler: async (client, message, args, guildService) => {
        const pojChannels = await guildService.getPingOnJoinChannels(message.guild.id) || [];

        if (pojChannels.length === 0) {
          return embeds.warn(message, 'No **ping on join** channels to reset');
        }

        try {
          await guildService.clearPingOnJoin(message.guild.id);
          return embeds.success(message, `Cleared all **${pojChannels.length}** ping on join channel${pojChannels.length === 1 ? '' : 's'}`);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, `Failed to reset ping on join: ${error.message}`);
        }
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');
    await ensureGuildData(message.guild.id);

    const sub = args[0]?.toLowerCase();
    if (!sub) return runHelpCommand(message, 'poj');

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'poj');
  }
};
