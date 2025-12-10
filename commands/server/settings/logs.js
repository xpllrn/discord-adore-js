const { EmbedBuilder, PermissionFlagsBits, ChannelType, ThreadAutoArchiveDuration } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const config = require('../../../config/setup');
const { findChannel } = require('../../../handlers/finder');
const { getService } = require('@services');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { createPagination } = require('../../../core/buttons');
const { getBotAvatarURL } = require('../../../utils/helpers');

function isValidWebhookUrl(url) {
  try {
    const webhookRegex = /^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    return webhookRegex.test(url);
  } catch {
    return false;
  }
}

module.exports = {
  name: "logs",
  aliases: ['logging', 'audit'],
  description: `Set up logging channels with webhooks for different log types`,
  syntax: 'logs [subcommand] (parameters)',
  example: 'logs add #logs all',
  permission: "manage_guild",
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: [],
      description: 'Add a logging channel',
      syntax: '{guildprefix}logs add [channel] [type]',
      parameters: ['channel', 'type'],
      example: '{guildprefix}logs add #logs all',

      handler: async (client, message, args, guildService) => {
        if (args.length < 1) return runHelpCommand(message, 'logs');

        const channelInput = args[0];
        const logTypeInput = args[1]?.toLowerCase();
        const webhookUrl = args[2];

        const validTypes = ['moderator', 'message', 'events', 'members'];
        let logTypesToAdd = [];

        if (!logTypeInput || logTypeInput === 'all') {
          logTypesToAdd = [...validTypes];
        } else {
          if (!validTypes.includes(logTypeInput)) {
            return embeds.warn(message, `Invalid log type! Valid types: \`${validTypes.join('`, `')}\`, \`all\``);
          }
          logTypesToAdd = [logTypeInput];
        }

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) {
          return embeds.warn(message, `Channel not found! ${channelResult.error}.`);
        }

        const channel = channelResult.channel;

        if (channel.type === ChannelType.GuildCategory) {
          return embeds.warn(message, `Cannot set up logging in category channels! Please select a text channel.`);
        }

        // Check if it's a forum thread (public thread with a forum parent)
        const isForumThread = channel.isThread() && channel.parent?.type === ChannelType.GuildForum;
        const isRegularThread = channel.isThread() && !isForumThread;

        // For regular threads (not forum threads), reject
        if (isRegularThread) {
          return embeds.warn(message, `Cannot set up logging in regular threads! Use the parent channel or a forum thread instead.`);
        }

        const supportedTypes = [ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildAnnouncement];
        if (!supportedTypes.includes(channel.type) && !isForumThread) {
          return embeds.warn(message, `Channel type not supported! Logging can only be set up in text channels or forum threads.`);
        }

        // For forum channels (not threads), we need to create or use a thread
        const isForumChannel = channel.type === ChannelType.GuildForum;

        try {
          const botMember = await message.guild.members.fetch(message.client.user.id);
          // For forum threads, check permissions on the parent forum channel
          const permissionChannel = isForumThread ? channel.parent : channel;
          const botPermissions = permissionChannel.permissionsFor(botMember);

          if (!botPermissions || !botPermissions.has(PermissionFlagsBits.ViewChannel)) {
            return embeds.warn(message, `I need **View Channel** permission in ${permissionChannel}!`);
          }

          if (!webhookUrl && !botPermissions.has(PermissionFlagsBits.ManageWebhooks)) {
            return embeds.warn(message, `I need **Manage Webhooks** permission in ${permissionChannel}!`);
          }

          // For forum channels, we need SendMessagesInThreads permission
          if ((isForumChannel || isForumThread) && !botPermissions.has(PermissionFlagsBits.SendMessagesInThreads)) {
            return embeds.warn(message, `I need **Send Messages in Threads** permission in ${permissionChannel}!`);
          }
        } catch (error) {
          return embeds.warn(message, 'Unable to check permissions for that channel.');
        }

        try {
          let finalWebhookUrl = webhookUrl;
          let threadId = null;
          let targetChannel = channel;

          // Handle forum channel - create a thread for logs
          if (isForumChannel) {
            // Create a new thread in the forum for logs
            const thread = await channel.threads.create({
              name: 'Audit Logs',
              autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
              message: { content: 'This thread is used for server audit logs.' },
              reason: `Logging setup by ${message.author.tag}`
            });
            threadId = thread.id;
            targetChannel = channel; // Webhook is created on the forum, not the thread
          } else if (isForumThread) {
            // Use existing forum thread
            threadId = channel.id;
            targetChannel = channel.parent; // Webhook is created on the parent forum
          }

          if (!finalWebhookUrl) {
            const webhook = await targetChannel.createWebhook({
              name: `adore Audits`,
              avatar: getBotAvatarURL(client, message.guild, { format: 'png' }),
              reason: `Logging setup by ${message.author.tag}`
            });
            finalWebhookUrl = webhook.url;
          }

          if (!isValidWebhookUrl(finalWebhookUrl)) {
            return embeds.warn(message, 'Invalid webhook URL format!');
          }

          // Use targetChannel.id for the config (forum channel ID, not thread ID)
          const configChannelId = isForumThread ? channel.parent.id : channel.id;

          let existingConfig = await guildService.getLoggingConfigForChannel(message.guild.id, configChannelId);
          let addedTypes = [];
          let alreadyEnabledTypes = [];

          if (existingConfig) {
            for (const logType of logTypesToAdd) {
              if (!existingConfig.logTypes.includes(logType)) {
                existingConfig.logTypes.push(logType);
                addedTypes.push(logType);
              } else {
                alreadyEnabledTypes.push(logType);
              }
            }

            if (addedTypes.length > 0) {
              await guildService.setLoggingChannel(message.guild.id, configChannelId, finalWebhookUrl, existingConfig.logTypes, message.author.id, threadId || existingConfig.threadId);
              let responseMessage = `Added **${addedTypes.join(', ')}** logging to ${channel}!\n\n**Current log types:** ${existingConfig.logTypes.join(', ')}`;
              if (alreadyEnabledTypes.length > 0) {
                responseMessage += `\n\n**Already enabled:** ${alreadyEnabledTypes.join(', ')}`;
              }
              return embeds.success(message, responseMessage);
            } else {
              return embeds.warn(message, `All specified log types are already enabled for ${channel}!`);
            }
          } else {
            await guildService.setLoggingChannel(message.guild.id, configChannelId, finalWebhookUrl, logTypesToAdd, message.author.id, threadId);
            if (logTypesToAdd.length === 1) {
              return embeds.success(message, `Successfully set up **${logTypesToAdd[0]}** logging in ${channel}!`);
            } else {
              return embeds.success(message, `Successfully set up **all log types** in ${channel}!`);
            }
          }
        } catch (error) {
          if (client?.errorLogger) {
            client.errorLogger.log(error, 'Logs Setup', { command: 'logs add', user: message.author, guild: message.guild });
          }
          return embeds.deny(message, 'Failed to set up logging. Please check my permissions.');
        }
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete'],
      description: 'Remove a logging channel',
      syntax: '{guildprefix}logs remove [channel] [type]',
      parameters: ['channel', 'type (optional)'],
      example: '{guildprefix}logs remove #logs',

      handler: async (client, message, args, guildService) => {
        if (args.length < 1) return runHelpCommand(message, 'logs');

        const channelInput = args[0];
        const logType = args[1]?.toLowerCase();

        const channelResult = findChannel(message.guild, channelInput);
        if (!channelResult.found) {
          return embeds.warn(message, `Channel not found! ${channelResult.error}`);
        }

        const channel = channelResult.channel;

        // Check if it's a forum thread
        const isForumThread = channel.isThread() && channel.parent?.type === ChannelType.GuildForum;
        // For forum threads, use the parent forum channel ID for config lookup
        const configChannelId = isForumThread ? channel.parent.id : channel.id;

        try {
          const loggingConfigs = await guildService.getLoggingConfig(message.guild.id);

          if (!loggingConfigs || loggingConfigs.length === 0) {
            return embeds.warn(message, 'No logging configurations found for this server.');
          }

          const logConfig = loggingConfigs.find(c => c.channelId === configChannelId);
          if (!logConfig) {
            return embeds.warn(message, `No logging configuration found for <#${channel.id}>.`);
          }

          if (logType) {
            const validTypes = ['moderator', 'message', 'events', 'members'];

            if (logType === 'all') {
              await guildService.removeLoggingChannel(message.guild.id, configChannelId);
              return embeds.success(message, `Removed all logging from <#${channel.id}>`);
            }

            if (!validTypes.includes(logType)) {
              return embeds.warn(message, `Invalid log type! Valid types: \`${validTypes.join('`, `')}\`, \`all\``);
            }

            if (!logConfig.logTypes.includes(logType)) {
              return embeds.warn(message, `**${logType}** logging is not enabled for <#${channel.id}>.`);
            }

            const updatedLogTypes = logConfig.logTypes.filter(type => type !== logType);

            if (updatedLogTypes.length === 0) {
              await guildService.removeLoggingChannel(message.guild.id, configChannelId);
              return embeds.success(message, `Removed **${logType}** logging from <#${channel.id}>. All logging has been disabled.`);
            } else {
              await guildService.setLoggingChannel(message.guild.id, configChannelId, logConfig.webhookUrl, updatedLogTypes, logConfig.createdBy, logConfig.threadId);
              return embeds.success(message, `Removed **${logType}** logging from <#${channel.id}>.\n\n**Remaining:** ${updatedLogTypes.join(', ')}`);
            }
          } else {
            await guildService.removeLoggingChannel(message.guild.id, configChannelId);
            return embeds.success(message, `Removed all logging from <#${channel.id}>`);
          }
        } catch (error) {
          if (client?.errorLogger) {
            client.errorLogger.log(error, 'Logs Remove', { command: 'logs remove', user: message.author, guild: message.guild });
          }
          return embeds.deny(message, 'Failed to remove logging configuration.');
        }
      }
    },

    list: {
      name: 'list',
      aliases: ['show'],
      description: 'List all logging channels',
      syntax: '{guildprefix}logs list',
      parameters: [],
      example: '{guildprefix}logs list',

      handler: async (client, message, args, guildService) => {
        try {
          const loggingConfigs = await guildService.getLoggingConfig(message.guild.id);

          if (!loggingConfigs || loggingConfigs.length === 0) {
            return embeds.warn(message, 'No logging configurations found');
          }

          const formatPage = (pageConfigs, currentPage, totalPages) => {
            const startIndex = (currentPage - 1) * 10;

            const configList = pageConfigs.map((logConfig, index) => {
              const number = (startIndex + index + 1).toString().padStart(2, '0');
              const channel = message.guild.channels.cache.get(logConfig.channelId);
              let channelDisplay = channel ? `<#${channel.id}>` : `\`${logConfig.channelId}\``;
              
              // Show thread info if configured
              if (logConfig.threadId) {
                const thread = message.guild.channels.cache.get(logConfig.threadId);
                const threadDisplay = thread ? `<#${thread.id}>` : `\`${logConfig.threadId}\``;
                channelDisplay += ` (thread: ${threadDisplay})`;
              }
              
              const types = logConfig.logTypes.map(type => `**${type}**`).join(', ');
              return `\`${number}\` ${types} - ${channelDisplay}`;
            }).join('\n');

            const entryText = loggingConfigs.length === 1 ? 'entry' : 'entries';

            return new EmbedBuilder()
              .setColor(config.colors.embed)
              .setTitle('Log Channels')
              .setDescription(configList)
              .setFooter({ text: `page ${currentPage}/${totalPages} (${loggingConfigs.length} ${entryText})` });
          };

          await createPagination(message, loggingConfigs, formatPage, 10, 'Log Channels');
        } catch (error) {
          if (client?.errorLogger) {
            client.errorLogger.log(error, 'Logs List', { command: 'logs list', user: message.author, guild: message.guild });
          }
          return embeds.deny(message, 'Failed to retrieve logging configurations.');
        }
      }
    }
  },

  run: async (client, message, args) => {
    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, "Manage Guild")) return;
    await ensureGuildData(message.guild.id);

    const guildService = getService('guild');

    const sub = args[0]?.toLowerCase();
    if (!sub) return runHelpCommand(message, 'logs');

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1), guildService);
    }

    return runHelpCommand(message, 'logs');
  }
};
