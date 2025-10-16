const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { createConfirmation } = require('../../../core/buttons');
const { findChannel } = require('../../../handlers/finder');
const guildCache = require('../../../database/cache/models/guild');
const { ensureGuildData } = require('../../../database');
const ms = require('ms');
const config = require('../../../config/setup');

module.exports = {
  name: "nuke",
  description: 'deletes channel and remakes a new one (admin only)',
  usage: `{guildprefix}nuke
{guildprefix}nuke add [channel] [interval] [message]
{guildprefix}nuke list
{guildprefix}nuke remove [channel]
{guildprefix}nuke view [channel]`,
  permission: 'Manage Guild',
  run: async(client, message, args) => {

    // Check if bot has required permissions
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return embeds.deny(message, 'I need **Manage Channels** permission to use this command');
    }

    await ensureGuildData(message.guild.id);

    // Handle subcommands
    if (args[0] === 'add') {
      return await handleAddScheduledNuke(message, args);
    } else if (args[0] === 'list') {
      return await handleListScheduledNukes(message);
    } else if (args[0] === 'remove') {
      return await handleRemoveScheduledNuke(message, args);
    } else if (args[0] === 'view') {
      return await handleViewScheduledNuke(message, args);
    } else if (args[0]) {
      // Invalid subcommand
      return false;
    }

    // Default nuke behavior (immediate nuke)
    const confirmationText = `Are you sure that you want to **nuke** this **channel**?`;

    await createConfirmation(message, confirmationText, async (interaction) => {
      await executeNuke(message, interaction);
    });
  }
}

// Separate function to handle the actual nuke logic
async function executeNuke(message, interaction) {
  try {
    // Store channel information
    const channelId = message.channel.id;
    const channelName = message.channel.name;
    const channelParent = message.channel.parent;
    const channelPosition = message.channel.position;
    const channelTopic = message.channel.topic;
    const channelNsfw = message.channel.nsfw;
    const channelRateLimitPerUser = message.channel.rateLimitPerUser;

    // Check if this channel is used for any server features using cache
    const guildCache = require('../../../database/cache/models/guild');
    const featuresToRestore = [];

    try {
      // Check all possible channel features using cache methods
      const welcomeChannel = await guildCache.getWelcomeChannel(message.guild.id);
      const boostChannel = await guildCache.getBoostChannel(message.guild.id);

      if (welcomeChannel === channelId) {
        featuresToRestore.push('Welcome Channel');
      }
      if (boostChannel === channelId) {
        featuresToRestore.push('Boost Channel');
      }
      // Add any other channel features you have in your database
    } catch (error) {
      console.error('Error checking channel features:', error);
    }

    // Clone the channel
    const newChannel = await message.channel.clone({
      name: channelName,
      topic: channelTopic,
      nsfw: channelNsfw,
      rateLimitPerUser: channelRateLimitPerUser,
      reason: `channel was nuked by ${message.author.tag}`
    });

    // Set parent and position
    if (channelParent) {
      await newChannel.setParent(channelParent.id);
    }
    await newChannel.setPosition(channelPosition);

    // Delete the old channel
    await message.channel.delete(`channel was nuked by ${message.author.tag}`);

    // Restore server features if any were using this channel
    if (featuresToRestore.length > 0) {
      try {
        // Update channel features using cache methods
        const welcomeChannel = await guildCache.getWelcomeChannel(message.guild.id);
        const boostChannel = await guildCache.getBoostChannel(message.guild.id);

        if (welcomeChannel === channelId) {
          await guildCache.setWelcomeChannel(message.guild.id, newChannel.id);
        }
        if (boostChannel === channelId) {
          await guildCache.setBoostChannel(message.guild.id, newChannel.id);
        }
      } catch (error) {
        console.error('Error updating channel features:', error);
      }
    }

    // Send confirmation message in new channel
    await newChannel.send('first');

  } catch (error) {
    // Try to send error in current channel if it still exists
    try {
      embeds.deny(message, 'An error occurred while trying to **nuke** this channel.');
    } catch (sendError) {
      // Silent fail if channel was already deleted
    }
  }
}

// Handler for adding scheduled nukes
async function handleAddScheduledNuke(message, args) {
  // nuke add #channel 2h hey sexy ass people
  if (args.length < 4) {
    return embeds.warn(message, 'Usage: `nuke add [channel] [interval] [message]`\nExample: `nuke add #general 2h hey sexy ass people`');
  }

  const channelInput = args[1];
  const intervalInput = args[2];
  const messageContent = args.slice(3).join(' ');

  // Find channel
  const channelResult = message.mentions.channels.first() ?
    { found: true, channel: message.mentions.channels.first() } :
    findChannel(message.guild, channelInput);

  if (!channelResult.found) {
    return embeds.warn(message, channelResult.error || 'Channel not found');
  }

  const channel = channelResult.channel;

  // Parse interval
  const intervalMs = ms(intervalInput);
  if (!intervalMs || intervalMs < 60000) { // Minimum 1 minute
    return embeds.warn(message, 'Invalid interval. Minimum is 1 minute. Examples: `1h`, `2h`, `30m`, `1d`');
  }

  // Check if channel already has scheduled nuke
  const existingNuke = await guildCache.getScheduledNuke(message.guild.id, channel.id);
  if (existingNuke) {
    return embeds.warn(message, `**${channel.name}** already has a scheduled nuke. Remove it first with \`nuke remove #${channel.name}\``);
  }

  // Calculate next nuke time
  const nextNuke = new Date(Date.now() + intervalMs);

  // Add scheduled nuke
  const newNuke = await guildCache.addScheduledNuke(message.guild.id, {
    channelId: channel.id,
    interval: intervalMs,
    message: messageContent,
    nextNuke: nextNuke,
    createdBy: message.author.id
  });

  const intervalDisplay = ms(intervalMs, { long: true });
  const nextNukeTimestamp = `<t:${Math.floor(nextNuke.getTime() / 1000)}:R>`;

  return embeds.success(message,
    `Successfully scheduled **${channel.name}** to be nuked every **${intervalDisplay}**!\n\n` +
    `**Message:** ${messageContent}\n` +
    `**Next nuke:** ${nextNukeTimestamp}`
  );
}

// Handler for listing scheduled nukes
async function handleListScheduledNukes(message) {
  const scheduledNukes = await guildCache.getScheduledNukes(message.guild.id);

  if (!scheduledNukes || scheduledNukes.length === 0) {
    return embeds.info(message, 'No scheduled nukes found in this server');
  }

  const embed = new EmbedBuilder()
    .setTitle('📋 Scheduled Nukes')
    .setColor(config.colors.embed)
    .setTimestamp();

  let description = '';
  for (const nuke of scheduledNukes) {
    const channel = message.guild.channels.cache.get(nuke.channelId);
    const channelName = channel ? `#${channel.name}` : `<#${nuke.channelId}>`;
    const intervalDisplay = ms(nuke.interval, { long: true });
    const nextNukeTimestamp = `<t:${Math.floor(new Date(nuke.nextNuke).getTime() / 1000)}:R>`;

    description += `**${channelName}**\n`;
    description += `> Interval: ${intervalDisplay}\n`;
    description += `> Next nuke: ${nextNukeTimestamp}\n`;
    description += `> Message: ${nuke.message}\n\n`;
  }

  embed.setDescription(description);
  return message.channel.send({ embeds: [embed] });
}

// Handler for removing scheduled nukes
async function handleRemoveScheduledNuke(message, args) {
  if (args.length < 2) {
    return embeds.warn(message, 'Usage: `nuke remove [channel]`\nExample: `nuke remove #general`');
  }

  const channelInput = args[1];

  // Find channel
  const channelResult = message.mentions.channels.first() ?
    { found: true, channel: message.mentions.channels.first() } :
    findChannel(message.guild, channelInput);

  if (!channelResult.found) {
    return embeds.warn(message, channelResult.error || 'Channel not found');
  }

  const channel = channelResult.channel;

  // Check if channel has scheduled nuke
  const existingNuke = await guildCache.getScheduledNuke(message.guild.id, channel.id);
  if (!existingNuke) {
    return embeds.warn(message, `**${channel.name}** does not have a scheduled nuke`);
  }

  // Remove scheduled nuke
  const removed = await guildCache.removeScheduledNuke(message.guild.id, channel.id);

  if (removed) {
    return embeds.success(message, `Successfully removed scheduled nuke for **${channel.name}**`);
  } else {
    return embeds.deny(message, 'Failed to remove scheduled nuke');
  }
}

// Handler for viewing scheduled nuke details
async function handleViewScheduledNuke(message, args) {
  if (args.length < 2) {
    return embeds.warn(message, 'Usage: `nuke view [channel]`\nExample: `nuke view #general`');
  }

  const channelInput = args[1];

  // Find channel
  const channelResult = message.mentions.channels.first() ?
    { found: true, channel: message.mentions.channels.first() } :
    findChannel(message.guild, channelInput);

  if (!channelResult.found) {
    return embeds.warn(message, channelResult.error || 'Channel not found');
  }

  const channel = channelResult.channel;

  // Get scheduled nuke details
  const scheduledNuke = await guildCache.getScheduledNuke(message.guild.id, channel.id);
  if (!scheduledNuke) {
    return embeds.warn(message, `**${channel.name}** does not have a scheduled nuke`);
  }

  const intervalDisplay = ms(scheduledNuke.interval, { long: true });
  const nextNukeTimestamp = `<t:${Math.floor(new Date(scheduledNuke.nextNuke).getTime() / 1000)}:R>`;
  const createdTimestamp = `<t:${Math.floor(new Date(scheduledNuke.createdAt).getTime() / 1000)}:f>`;
  const createdBy = message.guild.members.cache.get(scheduledNuke.createdBy);

  const embed = new EmbedBuilder()
    .setTitle(`🔥 Scheduled Nuke - #${channel.name}`)
    .setColor(config.colors.embed)
    .addFields(
      { name: '**Interval**', value: intervalDisplay, inline: true },
      { name: '**Next Nuke**', value: nextNukeTimestamp, inline: true },
      { name: '**Status**', value: scheduledNuke.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
      { name: '**Message**', value: scheduledNuke.message, inline: false },
      { name: '**Created**', value: `${createdTimestamp}\nby ${createdBy ? createdBy.user.tag : 'Unknown User'}`, inline: false }
    )
    .setTimestamp();

  return message.channel.send({ embeds: [embed] });
}

// Export the executeNuke function for use by the scheduler
module.exports.executeNuke = executeNuke;