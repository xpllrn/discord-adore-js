const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { ensureGuildData } = require('../../database');
const { createConfirmation } = require('../../core/buttons');
const guildCache = require('../../database/cache/models/guild');
const config = require('../../config/setup');
const { findChannel } = require('../../handlers/finder');
const PFPS = require('../../utils/pfpData');

module.exports = {
  name: 'autopost',
  aliases: ['ap'],
  description: 'Set up automatic posting of images to channels every 5 minutes',
  usage: `{guildprefix}autopost add [channel] [category]
{guildprefix}autopost remove [channel] [category]
{guildprefix}autopost remove [channel] (removes all)
{guildprefix}autopost list
{guildprefix}autopost reset`,
  permission: 'Manage Channels',
  run: async(client, message, args) => {

    await ensureGuildData(message.guild.id);

    if (args[0] === 'add') {

      const channelInput = args[1];
      const category = args[2]?.toLowerCase();

      if (!channelInput || !category) {
        return runHelpCommand(message, 'autopost');
      }

      // Find channel using universal finder
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) {
        return embeds.warn(message, `Channel not found! ${channelResult.error}\n\nPlease use a channel mention like <#1234567890> or the exact channel name.`);
      }

      const channel = channelResult.channel;

      // Check if channel is text-based
      if (!channel.isTextBased()) {
        return embeds.warn(message, 'The channel must be a text channel.');
      }

      // Check bot permissions
      const botPermissions = channel.permissionsFor(message.guild.members.me);
      if (!botPermissions.has(['SendMessages', 'EmbedLinks'])) {
        return embeds.warn(message, `I need **Send Messages** and **Embed Links** permissions in ${channel}.`);
      }

      // Validate category
      const validCategories = PFPS.getCategories();
      if (!validCategories.includes(category)) {
        return embeds.warn(message, `Invalid category! Valid categories: \`${validCategories.join('`, `')}\``);
      }

      // Check if category has images
      const imageCount = PFPS.getCategoryCount(category);
      if (imageCount === 0) {
        return embeds.warn(message, `The **${category}** category is empty.`);
      }

      // Get current autopost channels
      const currentAutoposts = await guildCache.getAutopostChannels(message.guild.id) || [];

      // Check if this specific channel + category combination already exists
      const existingAutopost = currentAutoposts.find(ap => ap.channelId === channel.id && ap.category === category);
      if (existingAutopost) {
        return embeds.warn(message, `**${channel.name}** already has autopost enabled for category **${category}**`);
      }

      // Check if we've reached the 10 autopost limit (can be multiple per channel)
      if (currentAutoposts.length >= 10) {
        return embeds.warn(message, 'You have reached the **maximum autopost configurations (10)**. Please remove some first.');
      }

      // Add the new autopost channel
      await guildCache.addAutopostChannel(message.guild.id, {
        channelId: channel.id,
        category: category,
        enabled: true,
        createdAt: new Date(),
        createdBy: message.author.id
      });

      // Start the autopost interval with immediate posting
      setupAutopost(client, message.guild.id, channel.id, category, true);

      const intervalDisplay = process.env.AUTOPOST_TEST_MODE === 'true' ? '1 minute' : '5 minutes';
      return embeds.success(message, `Successfully set up **autopost** in ${channel}!\n\n**Category:** ${category}\n**Images available:** ${imageCount.toLocaleString()}\n**Interval:** Every ${intervalDisplay}`);

    } else if (args[0] === 'remove' || args[0] === 'rm' || args[0] === 'delete' || args[0] === 'del') {

      const channelInput = args[1];
      const category = args[2]?.toLowerCase();

      if (!channelInput) {
        return runHelpCommand(message, 'autopost');
      }

      // Find channel using universal finder
      const channelResult = message.mentions.channels.first() ?
        { found: true, channel: message.mentions.channels.first() } :
        findChannel(message.guild, channelInput);

      if (!channelResult.found) {
        return embeds.warn(message, `Channel not found! ${channelResult.error}\n\nPlease use a channel mention like <#1234567890> or the exact channel name.`);
      }

      const channel = channelResult.channel;
      const currentAutoposts = await guildCache.getAutopostChannels(message.guild.id) || [];

      if (category) {
        // Remove specific category from channel
        const existingAutopost = currentAutoposts.find(ap => ap.channelId === channel.id && ap.category === category);
        if (!existingAutopost) {
          return embeds.warn(message, `**${channel.name}** does not have autopost enabled for category **${category}**`);
        }

        // Remove the specific autopost configuration
        await guildCache.removeAutopostChannel(message.guild.id, channel.id, category);

        // Stop the specific autopost interval
        stopAutopost(message.guild.id, channel.id, category);

        return embeds.success(message, `Removed **${category}** autopost from **${channel.name}**`);
      } else {
        // Remove all autoposts from channel
        const channelAutoposts = currentAutoposts.filter(ap => ap.channelId === channel.id);
        if (channelAutoposts.length === 0) {
          return embeds.warn(message, `**${channel.name}** does not have any autopost configurations`);
        }

        // Remove all autopost configurations for this channel
        for (const autopost of channelAutoposts) {
          await guildCache.removeAutopostChannel(message.guild.id, channel.id, autopost.category);
          stopAutopost(message.guild.id, channel.id, autopost.category);
        }

        return embeds.success(message, `Removed all autopost configurations from **${channel.name}** (${channelAutoposts.length} categories)`);
      }

    } else if (args[0] === 'list') {

      const autopostChannels = await guildCache.getAutopostChannels(message.guild.id) || [];

      if (autopostChannels.length === 0) {
        return embeds.warn(message, 'No autopost channels found\n\nUse `autopost add <#channel> <category>` to set up autopost.');
      }

      // Clean up invalid channels before displaying
      const validChannels = [];
      for (const autopost of autopostChannels) {
        const channel = message.guild.channels.cache.get(autopost.channelId);
        if (channel) {
          validChannels.push(autopost);
        } else {
          // Remove invalid channel
          await guildCache.removeAutopostChannel(message.guild.id, autopost.channelId);
        }
      }

      if (validChannels.length === 0) {
        return embeds.warn(message, 'No autopost channels found');
      }

      // Group by channel for better display
      const channelGroups = {};
      validChannels.forEach(autopost => {
        if (!channelGroups[autopost.channelId]) {
          channelGroups[autopost.channelId] = [];
        }
        channelGroups[autopost.channelId].push(autopost.category);
      });

      const channelList = Object.entries(channelGroups).map(([channelId, categories], index) => {
        const channel = message.guild.channels.cache.get(channelId);
        const channelNumber = (index + 1).toString().padStart(2, '0');
        const categoryDisplay = categories.map(cat =>
          cat.charAt(0).toUpperCase() + cat.slice(1)
        ).join(', ');
        return `\`${channelNumber}\` **${categoryDisplay}** <#${channel.id}>`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(config.colors.embed)
        .setTitle('Autopost Channels')
        .setDescription(channelList)
        .setFooter({ text: `Page 1/1 (${Object.keys(channelGroups).length} ${Object.keys(channelGroups).length === 1 ? 'channel' : 'channels'}, ${validChannels.length} ${validChannels.length === 1 ? 'configuration' : 'configurations'})` });

      return message.channel.send({ embeds: [embed] });

    } else if (args[0] === 'reset') {

      const autopostChannels = await guildCache.getAutopostChannels(message.guild.id) || [];

      if (autopostChannels.length === 0) {
        return embeds.warn(message, 'No autopost channels found');
      }

      await createConfirmation(
        message,
        'Are you sure you want to **remove all autopost channels**?',
        async (interaction) => {
          // On approve: delete all autopost channels
          await guildCache.clearAllAutopostChannels(message.guild.id);

          // Stop all autopost intervals
          for (const autopost of autopostChannels) {
            stopAutopost(message.guild.id, autopost.channelId, autopost.category);
          }

          // Edit the confirmation embed to show success message
          const successEmbed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setDescription(`✅ <@${message.author.id}>: Removed all autopost channels`);

          await interaction.editReply({ embeds: [successEmbed], components: [] });
        }
      );

    } else {
      return runHelpCommand(message, 'autopost');
    }
  }
};

// Autopost interval management
const autopostIntervals = new Map();

function setupAutopost(client, guildId, channelId, category, postImmediately = false) {
  const intervalKey = `${guildId}-${channelId}-${category}`;

  // Clear existing interval if any
  if (autopostIntervals.has(intervalKey)) {
    clearInterval(autopostIntervals.get(intervalKey));
  }


  // Post immediately if requested (on bot startup or manual setup)
  if (postImmediately) {
    postRandomImage(client, guildId, channelId, category);
  }

  // Set up new interval (5 minutes = 300000ms, or 1 minute = 60000ms for testing)
  const intervalTime = process.env.AUTOPOST_TEST_MODE === 'true' ? 60000 : 300000;
  const intervalDisplay = process.env.AUTOPOST_TEST_MODE === 'true' ? '1 minute' : '5 minutes';

  const interval = setInterval(async () => {
    await postRandomImage(client, guildId, channelId, category);
  }, intervalTime);

  autopostIntervals.set(intervalKey, interval);
}

function stopAutopost(guildId, channelId, category = null) {
  if (category) {
    // Stop specific category
    const intervalKey = `${guildId}-${channelId}-${category}`;

    if (autopostIntervals.has(intervalKey)) {
      clearInterval(autopostIntervals.get(intervalKey));
      autopostIntervals.delete(intervalKey);
      return true;
    }
    return false;
  } else {
    // Stop all categories for this channel (legacy support)
    let stopped = false;
    const keysToDelete = [];

    for (const [key, interval] of autopostIntervals.entries()) {
      if (key.startsWith(`${guildId}-${channelId}-`)) {
        clearInterval(interval);
        keysToDelete.push(key);
        stopped = true;
      }
    }

    keysToDelete.forEach(key => {
      autopostIntervals.delete(key);
      console.log(`🛑 Stopped autopost interval for ${key}`);
    });

    return stopped;
  }
}

async function postRandomImage(client, guildId, channelId, category) {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      stopAutopost(guildId, channelId);
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      stopAutopost(guildId, channelId);
      // Also remove from database
      await guildCache.removeAutopostChannel(guildId, channelId);
      return;
    }

    // Check if bot has permission to send messages
    if (!channel.permissionsFor(guild.members.me)?.has(['SendMessages', 'EmbedLinks'])) {
      return;
    }

    // Get random image from category
    let imageUrl;
    try {
      imageUrl = PFPS.getRandomImage(category);
    } catch (error) {
      console.error(`Failed to get random image for category ${category}:`, error);
      return;
    }

    if (!imageUrl) {
      console.error(`No image URL returned for category ${category}`);
      return;
    }

    // Create embed with the image
    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setImage(imageUrl)
      .setFooter({ text: `Category: ${category} • Auto-posted` })
      .setTimestamp();

    // Send the embed
    await channel.send({ embeds: [embed] });

    // Update lastPosted timestamp
    await guildCache.updateAutopostLastPosted(guildId, channelId, category);

  } catch (error) {
    console.error(`Autopost error for ${guildId}-${channelId}:`, error);
  }
}

// Export functions for use in other files
module.exports.setupAutopost = setupAutopost;
module.exports.stopAutopost = stopAutopost;
