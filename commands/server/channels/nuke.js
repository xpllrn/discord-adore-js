const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { getService } = require('@services');
const { createConfirmation } = require('../../../core/buttons');
const { findChannel } = require('../../../handlers/finder');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const config = require('../../../config/setup');
const ms = require('ms');
const logger = require('../../../utils/logger');

// Helper function to nuke a channel
async function nukeChannel(channel, message, guildService, customMessage = null) {
  // Store channel settings before deletion
  const channelData = {
    name: channel.name,
    type: channel.type,
    topic: channel.topic,
    nsfw: channel.nsfw,
    rateLimitPerUser: channel.rateLimitPerUser,
    position: channel.position,
    rawPosition: channel.rawPosition,
    parent: channel.parent,
    permissionOverwrites: channel.permissionOverwrites.cache.map(overwrite => ({
      id: overwrite.id,
      type: overwrite.type,
      allow: overwrite.allow.bitfield,
      deny: overwrite.deny.bitfield
    }))
  };

  const channelId = channel.id;
  
  // Get channel-specific settings
  const welcomeMsg = await guildService.getWelcomeMessageForChannel(message.guild.id, channelId);
  const leaveMsg = await guildService.getLeaveMessageForChannel(message.guild.id, channelId);
  const boostMsg = await guildService.getBoostMessage(message.guild.id, channelId);
  const loggingConfig = await guildService.getLoggingConfigForChannel(message.guild.id, channelId);
  
  // Get single channel reference settings
  const starboardChannel = await guildService.getStarboardChannel(message.guild.id);
  const voiceManager = await guildService.getVoiceManager(message.guild.id);
  const ticketSystem = await guildService.getTicketSystem(message.guild.id);
  const levelUpChannel = await guildService.getLevelUpChannel(message.guild.id);
  const countingData = await guildService.getCounting(message.guild.id);

  // Delete the channel
  await channel.delete(`Nuked by ${message.author.tag}`);

  // Create new channel with same settings
  const newChannel = await message.guild.channels.create({
    name: channelData.name,
    type: channelData.type,
    topic: channelData.topic,
    nsfw: channelData.nsfw,
    rateLimitPerUser: channelData.rateLimitPerUser,
    parent: channelData.parent,
    permissionOverwrites: channelData.permissionOverwrites
  });

  // Set the exact position after creation
  await newChannel.setPosition(channelData.rawPosition);

  // Restore database settings with new channel ID
  if (welcomeMsg) {
    await guildService.removeWelcomeMessage(message.guild.id, channelId);
    await guildService.addWelcomeMessage(message.guild.id, newChannel.id, welcomeMsg.message);
  }

  if (leaveMsg) {
    await guildService.removeLeaveMessage(message.guild.id, channelId);
    await guildService.addLeaveMessage(message.guild.id, newChannel.id, leaveMsg.message);
  }

  if (boostMsg) {
    await guildService.removeBoostMessage(message.guild.id, channelId);
    await guildService.addBoostMessage(message.guild.id, newChannel.id, boostMsg.message);
  }

  if (loggingConfig) {
    await guildService.removeLoggingChannel(message.guild.id, channelId);
    await guildService.setLoggingChannel(
      message.guild.id,
      newChannel.id,
      loggingConfig.webhookUrl,
      loggingConfig.logTypes,
      loggingConfig.createdBy
    );
  }

  if (starboardChannel === channelId) {
    await guildService.setStarboardChannel(message.guild.id, newChannel.id);
  }

  if (voiceManager) {
    let updated = false;
    const newConfig = { ...voiceManager };
    
    if (voiceManager.joinChannelId === channelId) {
      newConfig.joinChannelId = newChannel.id;
      updated = true;
    }
    
    if (voiceManager.mutedChannelId === channelId) {
      newConfig.mutedChannelId = newChannel.id;
      updated = true;
    }
    
    if (updated) {
      await guildService.setVoiceManager(message.guild.id, newConfig);
    }
  }

  if (ticketSystem && ticketSystem.setupChannelId === channelId) {
    await guildService.setTicketSystem(message.guild.id, {
      ...ticketSystem,
      setupChannelId: newChannel.id
    });
  }

  if (levelUpChannel === channelId) {
    await guildService.setLevelUpChannel(message.guild.id, newChannel.id);
  }

  if (countingData && countingData.channelId === channelId) {
    await guildService.setCounting(message.guild.id, {
      ...countingData,
      channelId: newChannel.id
    });
  }

  // Update scheduled nuke if exists
  const scheduledNuke = await guildService.getScheduledNuke(message.guild.id, channelId);
  if (scheduledNuke) {
    await guildService.removeScheduledNuke(message.guild.id, channelId);
    await guildService.addScheduledNuke(message.guild.id, newChannel.id, scheduledNuke.interval, scheduledNuke.message, scheduledNuke.addedBy);
  }

  // Send message in the new channel
  const nukeMessage = customMessage || 'first';
  await newChannel.send(nukeMessage);
  
  return newChannel;
}

module.exports = {
  name: "nuke",
  aliases: [],
  description: 'Nuke channel management',
  syntax: 'nuke [subcommand] (parameters)',
  example: 'nuke',
  permission: 'administrator',
  isGroupCommand: true,

  subcommands: {
    add: {
      name: 'add',
      aliases: ['schedule'],
      description: 'Schedule automatic nuke for a channel',
      syntax: '{guildprefix}nuke add [channel] [interval] (message)',
      parameters: ['channel', 'interval', 'message (optional)'],
      example: '{guildprefix}nuke add #general 24h Channel has been reset!',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) return embeds.warn(message, 'Please provide a **channel** to schedule nuke for');
        
        const channelResult = await findChannel(message.guild, args[0], client);
        if (!channelResult.found) return embeds.warn(message, channelResult.error);
        
        const channel = channelResult.channel;
        if (!channel.isTextBased()) return embeds.warn(message, 'I can only schedule nukes for text channels');

        if (!args[1]) return embeds.warn(message, 'Please provide an **interval** (e.g., 1h, 6h, 12h, 24h, 7d)');
        
        const interval = ms(args[1]);
        if (!interval || interval < ms('1h')) {
          return embeds.warn(message, 'Interval must be at least **1 hour**');
        }
        if (interval > ms('30d')) {
          return embeds.warn(message, 'Interval cannot exceed **30 days**');
        }

        const customMessage = args.slice(2).join(' ') || null;

        // Check if already scheduled
        const existing = await guildService.getScheduledNuke(message.guild.id, channel.id);
        if (existing) {
          return embeds.warn(message, `${channel} already has a scheduled nuke. Remove it first with \`nuke remove ${channel}\``);
        }

        await guildService.addScheduledNuke(message.guild.id, channel.id, interval, customMessage, message.author.id);

        const intervalText = ms(interval, { long: true });
        return embeds.success(message, `Scheduled nuke for ${channel} every **${intervalText}**${customMessage ? `\nMessage: ${customMessage}` : ''}`);
      }
    },

    remove: {
      name: 'remove',
      aliases: ['delete', 'cancel'],
      description: 'Remove scheduled nuke for a channel',
      syntax: '{guildprefix}nuke remove [channel]',
      parameters: ['channel'],
      example: '{guildprefix}nuke remove #general',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) return embeds.warn(message, 'Please provide a **channel** to remove scheduled nuke from');
        
        const channelResult = await findChannel(message.guild, args[0], client);
        if (!channelResult.found) return embeds.warn(message, channelResult.error);
        
        const channel = channelResult.channel;

        const existing = await guildService.getScheduledNuke(message.guild.id, channel.id);
        if (!existing) {
          return embeds.warn(message, `${channel} doesn't have a scheduled nuke`);
        }

        await guildService.removeScheduledNuke(message.guild.id, channel.id);
        return embeds.success(message, `Removed scheduled nuke for ${channel}`);
      }
    },

    view: {
      name: 'view',
      aliases: ['info'],
      description: 'View scheduled nuke details for a channel',
      syntax: '{guildprefix}nuke view [channel]',
      parameters: ['channel'],
      example: '{guildprefix}nuke view #general',

      handler: async (client, message, args, guildService) => {
        if (!args[0]) return embeds.warn(message, 'Please provide a **channel** to view');
        
        const channelResult = await findChannel(message.guild, args[0], client);
        if (!channelResult.found) return embeds.warn(message, channelResult.error);
        
        const channel = channelResult.channel;

        const scheduled = await guildService.getScheduledNuke(message.guild.id, channel.id);
        if (!scheduled) {
          return embeds.warn(message, `${channel} doesn't have a scheduled nuke`);
        }

        const intervalText = ms(scheduled.interval, { long: true });
        const nextNuke = scheduled.lastNuke 
          ? new Date(new Date(scheduled.lastNuke).getTime() + scheduled.interval)
          : new Date(new Date(scheduled.createdAt).getTime() + scheduled.interval);

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle(`Scheduled Nuke - #${channel.name}`)
          .addFields(
            { name: 'Channel', value: `${channel}`, inline: true },
            { name: 'Interval', value: intervalText, inline: true },
            { name: 'Next Nuke', value: `<t:${Math.floor(nextNuke.getTime() / 1000)}:R>`, inline: true },
            { name: 'Message', value: scheduled.message || 'first', inline: false },
            { name: 'Added By', value: `<@${scheduled.addedBy}>`, inline: true }
          )
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }
    },

    list: {
      name: 'list',
      aliases: ['all'],
      description: 'View all scheduled nukes',
      syntax: '{guildprefix}nuke list',
      parameters: [],
      example: '{guildprefix}nuke list',

      handler: async (client, message, args, guildService) => {
        const scheduledNukes = await guildService.getScheduledNukes(message.guild.id);

        if (!scheduledNukes || scheduledNukes.length === 0) {
          return embeds.info(message, 'No scheduled nukes in this server');
        }

        const embed = new EmbedBuilder()
          .setColor(config.colors.embed)
          .setTitle('Scheduled Nukes')
          .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) })
          .setTimestamp();

        const nukeList = scheduledNukes.map(nuke => {
          const channel = message.guild.channels.cache.get(nuke.channelId);
          const channelMention = channel ? channel.toString() : `Unknown (${nuke.channelId})`;
          const intervalText = ms(nuke.interval, { long: true });
          const nextNuke = nuke.lastNuke 
            ? new Date(new Date(nuke.lastNuke).getTime() + nuke.interval)
            : new Date(new Date(nuke.createdAt).getTime() + nuke.interval);
          
          return `${channelMention}\nInterval: **${intervalText}** | Next: <t:${Math.floor(nextNuke.getTime() / 1000)}:R>`;
        }).join('\n\n');

        embed.setDescription(nukeList);
        embed.setFooter({ text: `${scheduledNukes.length} scheduled nuke${scheduledNukes.length !== 1 ? 's' : ''}` });

        return message.channel.send({ embeds: [embed] });
      }
    }
  },

  run: async (client, message, args) => {
    const guildService = getService('guild');

    // Check for subcommand
    const sub = args[0]?.toLowerCase();
    
    if (sub) {
      const subcommand = Object.values(module.exports.subcommands)
        .find(s => s.name === sub || s.aliases.includes(sub));

      if (subcommand) {
        // Subcommands require Administrator
        if (!await hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator')) return;
        return subcommand.handler(client, message, args.slice(1), guildService);
      }
    }

    // Default behavior: nuke current channel (requires Manage Channels)
    if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return embeds.deny(message, 'I need **Manage Channels** permission to use this command');
    }

    const channel = message.channel;

    // Show confirmation dialog
    await createConfirmation(
      message,
      `Are you sure you want to **nuke** <#${channel.id}>? This will delete and recreate the channel.`,
      async (interaction, confirmMessage) => {
        try {
          // Delete the confirmation message first
          try {
            await confirmMessage.delete();
          } catch (e) {
            // Ignore if already deleted
          }

          const newChannel = await nukeChannel(channel, message, guildService);
          
          const successContext = {
            author: message.author,
            channel: newChannel
          };
          await embeds.success(successContext, `Channel nuked by **${message.author.tag}**`);

        } catch (error) {
          logger.webhook.error(error, message);
          try {
            const errorChannel = message.guild.channels.cache.find(ch => 
              ch.isTextBased() && 
              ch.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.SendMessages)
            );
            
            if (errorChannel) {
              const errorContext = {
                author: message.author,
                channel: errorChannel
              };
              await embeds.deny(errorContext, `Failed to nuke channel: ${error.message}`);
            }
          } catch (sendError) {
            // Can't send error anywhere
          }
        }
      }
    );
  }
};
