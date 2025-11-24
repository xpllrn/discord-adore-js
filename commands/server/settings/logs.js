const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { ensureGuildData } = require('../../../database');
const config = require('../../../config/setup');
const { findChannel } = require('../../../handlers/finder');
const { getService } = require('@services');
const permissions = require('../../../utils/permissions');

module.exports = {
  name: "logs",
  aliases: ['logging', 'audit'],
  description: `Set up logging channels with webhooks for different log types`,
  syntax: 'logs [subcommand] (parameters)',
  example: 'logs add #logs all',
  permission: "manage_guild",
  isGroupCommand: true,
  run: async (client, message, args) => {
    const guildService = getService('guild');
    try {
      // Check permissions
      if (!permissions.hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, "Manage Guild")) {
        return;
      }

      // Ensure guild data exists
      await ensureGuildData(message.guild.id);

      const subcommand = args[0]?.toLowerCase();

      switch (subcommand) {
        case 'add': {
          const subcommandInfo = {
            description: 'Add a logging channel',
            usage: '{guildprefix}logs add [channel] [type]',
            aliases: [],
            parameters: ['channel', 'type'],
            example: '{guildprefix}logs add #logs all'
          };
          await handleAdd(client, message, args.slice(1));
          break;
        }
        case 'remove':
        case 'delete': {
          const subcommandInfo = {
            description: 'Remove a logging channel',
            usage: '{guildprefix}logs remove [channel] [type]',
            aliases: ['delete'],
            parameters: ['channel', 'type (optional)'],
            example: '{guildprefix}logs remove #logs'
          };
          await handleRemove(client, message, args.slice(1));
          break;
        }
        case 'list':
        case 'show': {
          const subcommandInfo = {
            description: 'List all logging channels',
            usage: '{guildprefix}logs list',
            aliases: ['show'],
            parameters: [],
            example: '{guildprefix}logs list'
          };
          await handleList(client, message);
          break;
        }
        default:
          const { runHelpCommand } = require('../../../utils/commandProcessor');
          return runHelpCommand(message, 'logs');
      }
    } catch (error) {
      // Send error to webhook instead of console
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Logs Command', {
          command: 'logs',
          args: args.join(' ') || '',
          user: message.author,
          guild: message.guild,
          channel: message.channel
        });
      }
      embeds.deny(message, 'An error occurred while processing the logs command.');
    }
  }
};

async function handleAdd(client, message, args) {
  const guildService = getService('guild');
  const { runHelpCommand } = require('../../../utils/commandProcessor');
  
  if (args.length < 1) {
    return runHelpCommand(message, 'logs');
  }

  const channelInput = args[0];
  const logTypeInput = args[1]?.toLowerCase();
  const webhookUrl = args[2];

  // If no log type specified or "all" is specified, add all types
  const validTypes = ['moderator', 'message', 'events', 'members'];
  let logTypesToAdd = [];

  if (!logTypeInput || logTypeInput === 'all') {
    // Add all log types
    logTypesToAdd = [...validTypes];
  } else {
    // Validate single log type
    if (!validTypes.includes(logTypeInput)) {
      return embeds.warn(message, `Invalid log type! Valid types: \`${validTypes.join('`, `')}\`, \`all\``);
    }
    logTypesToAdd = [logTypeInput];
  }

  // Find channel using universal finder
  const channelResult = findChannel(message.guild, channelInput);

  if (!channelResult.found) {
    return embeds.warn(message, `Channel not found! ${channelResult.error}.`);
  }

  const channel = channelResult.channel;

  // Ensure it's not a category channel (categories don't support webhooks)
  if (channel.type === ChannelType.GuildCategory) {
    return embeds.warn(message, `Cannot set up logging in category channels! Please select a text channel, forum channel, or announcement channel.`);
  }

  // Ensure it's a channel that supports webhooks (text channels and forum channels)
  const supportedTypes = [ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildAnnouncement];
  if (!supportedTypes.includes(channel.type)) {
    return embeds.warn(message, `Channel type not supported! Logging can only be set up in text channels, forum channels, or announcement channels. Found channel type: ${channel.type}`);
  }

  // Check if bot has permissions in the channel
  try {
    const botMember = await message.guild.members.fetch(message.client.user.id);
    const botPermissions = channel.permissionsFor(botMember);

    if (!botPermissions || !botPermissions.has(PermissionFlagsBits.ViewChannel)) {
      return embeds.warn(message, `I need **View Channel** permission in ${channel}!`);
    }

    // Only check for ManageWebhooks if we're creating a webhook (no webhook URL provided)
    if (!webhookUrl && !botPermissions.has(PermissionFlagsBits.ManageWebhooks)) {
      return embeds.warn(message, `I need **Manage Webhooks** permission in ${channel} to create a webhook! Alternatively, you can provide your own webhook URL: \`logs add ${channel} ${logTypeInput || 'all'} <webhook_url>\``);
    }
  } catch (error) {
    return embeds.warn(message, 'Unable to check permissions for that channel.');
  }

  try {
    let finalWebhookUrl = webhookUrl;

    // If no webhook URL provided, create one
    if (!finalWebhookUrl) {
      const webhook = await channel.createWebhook({
        name: `adore Audits`,
        avatar: client.user.displayAvatarURL({ format: 'png' }),
        reason: `Logging setup by ${message.author.tag}`
      });
      finalWebhookUrl = webhook.url;
    }

    // Validate webhook URL format
    if (!isValidWebhookUrl(finalWebhookUrl)) {
      return embeds.warn(message, 'Invalid webhook URL format!');
    }

    // Check if logging config already exists for this channel
    let existingConfig = await guildService.getLoggingConfigForChannel(message.guild.id, channel.id);
    let addedTypes = [];
    let alreadyEnabledTypes = [];

    if (existingConfig) {
      // Add log types to existing config if not already present
      for (const logType of logTypesToAdd) {
        if (!existingConfig.logTypes.includes(logType)) {
          existingConfig.logTypes.push(logType);
          addedTypes.push(logType);
        } else {
          alreadyEnabledTypes.push(logType);
        }
      }

      if (addedTypes.length > 0) {
        // Update with merged log types
        await guildService.setLoggingChannel(
          message.guild.id,
          channel.id,
          finalWebhookUrl,
          existingConfig.logTypes,
          message.author.id
        );

        let responseMessage = `Added **${addedTypes.join(', ')}** logging to ${channel}!\n\n**Current log types:** ${existingConfig.logTypes.join(', ')}`;
        if (alreadyEnabledTypes.length > 0) {
          responseMessage += `\n\n**Already enabled:** ${alreadyEnabledTypes.join(', ')}`;
        }
        embeds.success(message, responseMessage);
      } else {
        embeds.warn(message, `All specified log types are already enabled for ${channel}!\n\n**Current log types:** ${existingConfig.logTypes.join(', ')}`);
      }
    } else {
      // Create new logging config
      await guildService.setLoggingChannel(
        message.guild.id,
        channel.id,
        finalWebhookUrl,
        logTypesToAdd,
        message.author.id
      );

      if (logTypesToAdd.length === 1) {
        embeds.success(message, `Successfully set up **${logTypesToAdd[0]}** logging in ${channel}!`);
      } else {
        embeds.success(message, `Successfully set up **all log types** in ${channel}!`);
      }
    }

  } catch (error) {
    // Send error to webhook instead of console
    if (client?.errorLogger) {
      client.errorLogger.log(error, 'Logs Setup', {
        command: 'logs add',
        args: args.join(' ') || '',
        user: message.author,
        guild: message.guild,
        channel: message.channel
      });
    }
    embeds.deny(message, 'Failed to set up logging. Please check my permissions and try again.');
  }
}

async function handleRemove(client, message, args) {
  const guildService = getService('guild');
  const { runHelpCommand } = require('../../../utils/commandProcessor');
  
  if (args.length < 1) {
    return runHelpCommand(message, 'logs');
  }

  const channelInput = args[0];
  const logType = args[1]?.toLowerCase();

  // Find channel using universal finder
  const channelResult = findChannel(message.guild, channelInput);
  if (!channelResult.found) {
    return embeds.warn(message, `Channel not found! ${channelResult.error}\n\nPlease use a channel mention like <#1234567890> or the exact channel name.`);
  }

  const channel = channelResult.channel;

  try {
    const loggingConfigs = await guildService.getLoggingConfig(message.guild.id);

    if (!loggingConfigs || loggingConfigs.length === 0) {
      return embeds.warn(message, 'No logging configurations found for this server.');
    }

    const config = loggingConfigs.find(config => config.channelId === channel.id);

    if (!config) {
      return embeds.warn(message, `No logging configuration found for <#${channel.id}>.`);
    }

    if (logType) {
      // Remove specific log type or all types
      const validTypes = ['moderator', 'message', 'events', 'members'];
      
      if (logType === 'all') {
        // Remove entire config (all log types)
        await guildService.removeLoggingChannel(message.guild.id, channel.id);
        return embeds.success(message, `Removed all logging from <#${channel.id}>`);
      }
      
      if (!validTypes.includes(logType)) {
        return embeds.warn(message, `Invalid log type! Valid types: \`${validTypes.join('`, `')}\`, \`all\``);
      }

      if (!config.logTypes.includes(logType)) {
        return embeds.warn(message, `**${logType}** logging is not enabled for <#${channel.id}>.`);
      }

      // Remove the log type from the array
      const updatedLogTypes = config.logTypes.filter(type => type !== logType);

      if (updatedLogTypes.length === 0) {
        // If no log types remain, remove the entire config
        await guildService.removeLoggingChannel(message.guild.id, channel.id);
        embeds.success(message, `Removed **${logType}** logging from <#${channel.id}>. All logging has been disabled for this channel.`);
      } else {
        // Update with remaining log types
        await guildService.setLoggingChannel(
          message.guild.id,
          channel.id,
          config.webhookUrl,
          updatedLogTypes,
          config.createdBy
        );
        embeds.success(message, `Removed **${logType}** logging from <#${channel.id}>.\n\n**Remaining log types:** ${updatedLogTypes.join(', ')}`);
      }
    } else {
      // Remove entire config (all log types)
      await guildService.removeLoggingChannel(message.guild.id, channel.id);

      embeds.success(message, `Removed all logging from <#${channel.id}>`);
    }

  } catch (error) {
    // Send error to webhook instead of console
    if (client?.errorLogger) {
      client.errorLogger.log(error, 'Logs Remove', {
        command: 'logs remove',
        args: args.join(' ') || '',
        user: message.author,
        guild: message.guild,
        channel: message.channel
      });
    }
    embeds.deny(message, 'Failed to remove logging configuration.');
  }
}

async function handleList(client, message) {
  const guildService = getService('guild');
  const { createPagination } = require('../../../core/buttons');
  
  try {
    const loggingConfigs = await guildService.getLoggingConfig(message.guild.id);

    if (!loggingConfigs || loggingConfigs.length === 0) {
      return embeds.warn(message, 'No logging configurations found');
    }

    // Format page function for pagination
    const formatPage = (pageConfigs, currentPage, totalPages) => {
      const startIndex = (currentPage - 1) * 10;

      const configList = pageConfigs.map((config, index) => {
        const number = (startIndex + index + 1).toString().padStart(2, '0');
        const channel = message.guild.channels.cache.get(config.channelId);
        const channelDisplay = channel ? `<#${channel.id}>` : `\`${config.channelId}\``;
        const types = config.logTypes.map(type => `**${type}**`).join(', ');
        
        return `\`${number}\` ${types} - ${channelDisplay}`;
      }).join('\n');

      const entryText = loggingConfigs.length === 1 ? 'entry' : 'entries';

      return new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle('Log Channels')
        .setDescription(configList)
        .setFooter({ text: `page ${currentPage}/${totalPages} (${loggingConfigs.length} ${entryText})` });
    };

    // Use pagination system with 10 items per page
    await createPagination(message, loggingConfigs, formatPage, 10, 'Log Channels');

  } catch (error) {
    // Send error to webhook instead of console
    if (client?.errorLogger) {
      client.errorLogger.log(error, 'Logs List', {
        command: 'logs list',
        args: '',
        user: message.author,
        guild: message.guild,
        channel: message.channel
      });
    }
    embeds.deny(message, 'Failed to retrieve logging configurations.');
  }
}



function isValidWebhookUrl(url) {
  try {
    const webhookRegex = /^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    return webhookRegex.test(url);
  } catch {
    return false;
  }
}
