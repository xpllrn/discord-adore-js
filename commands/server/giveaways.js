const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { ensureGuildData } = require('../../database');
const { hasDiscordPermission } = require('../../utils/permissions');
const { runHelpCommand } = require('../../utils/commandProcessor');
const { findChannel, findUser, findRole } = require('../../handlers/finder');
const guildCache = require('../../database/cache/models/guild');
const config = require('../../config/setup');
const ms = require('ms');

module.exports = {
  name: "giveaways",
  aliases: ['giveaway', 'gw'],
  description: `Manage server giveaways`,
  usage: `{guildprefix}giveaways start [duration] [winners] [title]
{guildprefix}giveaways start [channel] [duration] [winners] [title]

{guildprefix}giveaways end [message_link]
{guildprefix}giveaways list
{guildprefix}giveaways cancel [message_link]
{guildprefix}giveaways reroll [message_link] [winners]

{guildprefix}giveaways edit level [message_link] [level]
{guildprefix}giveaways edit role [message_link] [role]
{guildprefix}giveaways edit host [message_link] [user]
{guildprefix}giveaways edit description [message_link] [description]
{guildprefix}giveaways edit image [message_link] [image_url]`,
  permission: "Manage Channels",

  run: async(client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;

    if (!args[0]) {
      return runHelpCommand(message, 'giveaways');
    }

    // Ensure guild data exists in the database
    await ensureGuildData(message.guild.id);

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'start':
        return await handleStart(client, message, args.slice(1));
      case 'end':
        return await handleEnd(client, message, args.slice(1));
      case 'list':
        return await handleList(client, message, args.slice(1));
      case 'cancel':
        return await handleCancel(client, message, args.slice(1));
      case 'reroll':
        return await handleReroll(client, message, args.slice(1));
      case 'edit':
        return await handleEdit(client, message, args.slice(1));
      default:
        return runHelpCommand(message, 'giveaways');
    }
  }
};

// Helper function to parse message links
function parseMessageLink(link) {
  const messageLinkRegex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
  const match = link.match(messageLinkRegex);
  
  if (match) {
    return {
      guildId: match[1],
      channelId: match[2],
      messageId: match[3]
    };
  }
  return null;
}

// Helper function to format duration
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds > 1 ? 's' : ''}`;
}

// Helper function to create giveaway embed
function createGiveawayEmbed(giveaway, guild) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.embed)
    .setTitle(giveaway.title)
    .setDescription(giveaway.description)
    .addFields(
      { name: 'Ends', value: `<t:${Math.floor(new Date(giveaway.endTime).getTime() / 1000)}:R>`, inline: true },
      { name: 'Winners', value: giveaway.winners.toString(), inline: true },
      { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true }
    )
    .setFooter({ text: `${giveaway.participants.length} participants` })
    .setTimestamp();

  if (guild) {
    embed.setAuthor({
      name: guild.name,
      iconURL: guild.iconURL({ dynamic: true })
    });
  }

  if (giveaway.image) {
    embed.setImage(giveaway.image);
  }

  // Add requirements if any
  const requirements = [];
  if (giveaway.requirements.level) {
    requirements.push(`> Must have **level ${giveaway.requirements.level}**`);
  }
  if (giveaway.requirements.roleId) {
    requirements.push(`> Must have <@&${giveaway.requirements.roleId}>`);
  }

  if (requirements.length > 0) {
    embed.addFields({ name: '**Requirements**', value: requirements.join('\n'), inline: false });
  }

  return embed;
}

// Start giveaway subcommand
async function handleStart(client, message, args) {
  if (args.length < 3) {
    return embeds.warn(message, 'Usage: `giveaways start [duration] [winners] [title]` or `giveaways start [channel] [duration] [winners] [title]`');
  }

  let channel = message.channel;
  let duration, winners, title;
  let argIndex = 0;

  // Check if first argument is a channel
  const channelResult = await findChannel(message.guild, args[0], client);
  if (channelResult.found) {
    channel = channelResult.channel;
    argIndex = 1;
  }

  // Parse duration (default to 24h if not provided or invalid)
  const durationArg = args[argIndex];
  const parsedDuration = ms(durationArg);
  
  if (parsedDuration && parsedDuration > 0) {
    duration = parsedDuration;
    argIndex++;
  } else {
    duration = ms('24h'); // Default duration
  }

  // Parse winners (default to 1 if not provided or invalid)
  const winnersArg = args[argIndex];
  const parsedWinners = parseInt(winnersArg);
  
  if (parsedWinners && parsedWinners > 0 && parsedWinners <= 20) {
    winners = parsedWinners;
    argIndex++;
  } else if (!isNaN(parsedWinners)) {
    // If it's a number but out of range
    return embeds.warn(message, 'Number of winners must be between **1** and **20**');
  } else {
    winners = 1; // Default winners
  }

  // Get title (remaining arguments)
  title = args.slice(argIndex).join(' ');
  if (!title) {
    return embeds.warn(message, 'Please provide a **title** for the giveaway');
  }

  if (title.length > 256) {
    return embeds.warn(message, 'Giveaway title must be **256 characters or less**');
  }

  // Validate duration (minimum 1 minute, maximum 30 days)
  const minDuration = ms('1m');
  const maxDuration = ms('30d');
  
  if (duration < minDuration) {
    return embeds.warn(message, 'Giveaway duration must be at least **1 minute**');
  }
  
  if (duration > maxDuration) {
    return embeds.warn(message, 'Giveaway duration cannot exceed **30 days**');
  }

  try {
    const endTime = new Date(Date.now() + duration);
    
    // Create giveaway embed
    const giveawayData = {
      title,
      description: 'React with 🎉 to enter the giveaway.',
      channelId: channel.id,
      messageId: null, // Will be set after message is sent
      hostId: message.author.id,
      winners,
      endTime,
      requirements: { level: null, roleId: null },
      participants: [],
      winnerIds: [],
      image: null,
      isActive: true
    };

    const embed = createGiveawayEmbed(giveawayData, message.guild);
    
    // Send giveaway message
    const giveawayMessage = await channel.send({ embeds: [embed] });
    
    // Add reaction
    await giveawayMessage.react('🎉');
    
    // Update giveaway data with message ID and save to database
    giveawayData.messageId = giveawayMessage.id;
    await guildCache.addGiveaway(message.guild.id, giveawayData);
    
    return embeds.success(message, `Giveaway **${title}** started in ${channel}!`);

  } catch (error) {
    console.error('Error starting giveaway:', error);
    return embeds.deny(message, 'Failed to start giveaway. Please check my permissions.');
  }
}

// Helper function to select random winners
function selectRandomWinners(participants, count) {
  if (participants.length <= count) {
    return [...participants];
  }

  const shuffled = [...participants].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// End giveaway subcommand
async function handleEnd(client, message, args) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a **message link** to the giveaway you want to end');
  }

  const linkData = parseMessageLink(args[0]);
  if (!linkData) {
    return embeds.warn(message, 'Invalid message link format');
  }

  if (linkData.guildId !== message.guild.id) {
    return embeds.warn(message, 'I can only end giveaways from this server');
  }

  const giveaway = await guildCache.getGiveawayByMessageId(message.guild.id, linkData.messageId);
  if (!giveaway) {
    return embeds.warn(message, 'No giveaway found with that message link');
  }

  if (!giveaway.isActive) {
    return embeds.warn(message, 'This giveaway has already ended');
  }

  try {
    // Get the giveaway channel and message
    const channel = message.guild.channels.cache.get(linkData.channelId);
    if (!channel) {
      return embeds.warn(message, 'Giveaway channel not found');
    }

    const giveawayMessage = await channel.messages.fetch(linkData.messageId);
    if (!giveawayMessage) {
      return embeds.warn(message, 'Giveaway message not found');
    }

    // Select winners
    const winners = selectRandomWinners(giveaway.participants, giveaway.winners);

    // End the giveaway in database
    await guildCache.endGiveaway(message.guild.id, giveaway.id, winners);

    // Update the giveaway message
    const endedEmbed = createGiveawayEmbed({ ...giveaway, isActive: false, winnerIds: winners }, message.guild)
      .setColor(config.colors.success)
      .setTitle(`🎉 ${giveaway.title} (ENDED)`);

    if (winners.length > 0) {
      endedEmbed.addFields({
        name: 'Winners',
        value: winners.map(id => `<@${id}>`).join('\n'),
        inline: false
      });
    } else {
      endedEmbed.addFields({
        name: 'Winners',
        value: 'No valid participants',
        inline: false
      });
    }

    await giveawayMessage.edit({ embeds: [endedEmbed] });

    // Announce winners
    if (winners.length > 0) {
      const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
      await channel.send(`🎉 Congratulations ${winnerMentions}! You won **${giveaway.title}**!`);
    } else {
      await channel.send(`😔 No valid participants for **${giveaway.title}**. No winners selected.`);
    }

    return embeds.success(message, `Giveaway **${giveaway.title}** has been ended!`);

  } catch (error) {
    console.error('Error ending giveaway:', error);
    return embeds.deny(message, 'Failed to end giveaway. Please check my permissions.');
  }
}

// List giveaways subcommand
async function handleList(client, message, args) {
  const activeGiveaways = await guildCache.getActiveGiveaways(message.guild.id);

  if (activeGiveaways.length === 0) {
    return embeds.info(message, 'There are no active giveaways in this server');
  }

  const embed = new EmbedBuilder()
    .setColor(config.colors.embed)
    .setTitle('Active Giveaways')
    .setAuthor({
      name: message.guild.name,
      iconURL: message.guild.iconURL({ dynamic: true })
    })
    .setTimestamp();

  const giveawayList = activeGiveaways.map(giveaway => {
    const channel = message.guild.channels.cache.get(giveaway.channelId);
    const channelMention = channel ? channel.toString() : 'Unknown Channel';
    const endTime = Math.floor(new Date(giveaway.endTime).getTime() / 1000);

    return `**${giveaway.title}**\n` +
           `Channel: ${channelMention}\n` +
           `Winners: ${giveaway.winners} | Participants: ${giveaway.participants.length}\n` +
           `Ends: <t:${endTime}:R>\n` +
           `[Jump to Message](https://discord.com/channels/${message.guild.id}/${giveaway.channelId}/${giveaway.messageId})`;
  }).join('\n\n');

  embed.setDescription(giveawayList);
  embed.setFooter({ text: `${activeGiveaways.length} active giveaway${activeGiveaways.length !== 1 ? 's' : ''}` });

  return message.channel.send({ embeds: [embed] });
}

// Cancel giveaway subcommand
async function handleCancel(client, message, args) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a **message link** to the giveaway you want to cancel');
  }

  const linkData = parseMessageLink(args[0]);
  if (!linkData) {
    return embeds.warn(message, 'Invalid message link format');
  }

  if (linkData.guildId !== message.guild.id) {
    return embeds.warn(message, 'I can only cancel giveaways from this server');
  }

  const giveaway = await guildCache.getGiveawayByMessageId(message.guild.id, linkData.messageId);
  if (!giveaway) {
    return embeds.warn(message, 'No giveaway found with that message link');
  }

  if (!giveaway.isActive) {
    return embeds.warn(message, 'This giveaway has already ended');
  }

  try {
    // Get the giveaway channel and message
    const channel = message.guild.channels.cache.get(linkData.channelId);
    if (!channel) {
      return embeds.warn(message, 'Giveaway channel not found');
    }

    const giveawayMessage = await channel.messages.fetch(linkData.messageId);
    if (!giveawayMessage) {
      return embeds.warn(message, 'Giveaway message not found');
    }

    // Delete the giveaway from database
    await guildCache.deleteGiveaway(message.guild.id, giveaway.id);

    // Update the message to show it's cancelled
    const cancelledEmbed = createGiveawayEmbed(giveaway, message.guild)
      .setColor(config.colors.error)
      .setTitle(`❌ ${giveaway.title} (CANCELLED)`)
      .setDescription('This giveaway has been cancelled by a moderator.');

    await giveawayMessage.edit({ embeds: [cancelledEmbed] });

    return embeds.success(message, `Giveaway **${giveaway.title}** has been cancelled!`);

  } catch (error) {
    console.error('Error cancelling giveaway:', error);
    return embeds.deny(message, 'Failed to cancel giveaway. Please check my permissions.');
  }
}

// Reroll giveaway subcommand
async function handleReroll(client, message, args) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a **message link** to the giveaway you want to reroll');
  }

  const linkData = parseMessageLink(args[0]);
  if (!linkData) {
    return embeds.warn(message, 'Invalid message link format');
  }

  if (linkData.guildId !== message.guild.id) {
    return embeds.warn(message, 'I can only reroll giveaways from this server');
  }

  const giveaway = await guildCache.getGiveawayByMessageId(message.guild.id, linkData.messageId);
  if (!giveaway) {
    return embeds.warn(message, 'No giveaway found with that message link');
  }

  if (giveaway.isActive) {
    return embeds.warn(message, 'Cannot reroll an active giveaway. End it first.');
  }

  // Parse number of winners to reroll (default to original winner count)
  let winnersToReroll = giveaway.winners;
  if (args[1]) {
    const parsed = parseInt(args[1]);
    if (parsed && parsed > 0 && parsed <= 20) {
      winnersToReroll = parsed;
    } else if (!isNaN(parsed)) {
      return embeds.warn(message, 'Number of winners must be between **1** and **20**');
    }
  }

  try {
    // Get the giveaway channel and message
    const channel = message.guild.channels.cache.get(linkData.channelId);
    if (!channel) {
      return embeds.warn(message, 'Giveaway channel not found');
    }

    const giveawayMessage = await channel.messages.fetch(linkData.messageId);
    if (!giveawayMessage) {
      return embeds.warn(message, 'Giveaway message not found');
    }

    // Select new winners
    const newWinners = selectRandomWinners(giveaway.participants, winnersToReroll);

    // Update the giveaway in database
    await guildCache.updateGiveaway(message.guild.id, giveaway.id, { winnerIds: newWinners });

    // Update the giveaway message
    const rerolledEmbed = createGiveawayEmbed({ ...giveaway, winnerIds: newWinners }, message.guild)
      .setColor(config.colors.success)
      .setTitle(`🎉 ${giveaway.title} (REROLLED)`);

    if (newWinners.length > 0) {
      rerolledEmbed.addFields({
        name: 'New Winners',
        value: newWinners.map(id => `<@${id}>`).join('\n'),
        inline: false
      });
    } else {
      rerolledEmbed.addFields({
        name: 'New Winners',
        value: 'No valid participants',
        inline: false
      });
    }

    await giveawayMessage.edit({ embeds: [rerolledEmbed] });

    // Announce new winners
    if (newWinners.length > 0) {
      const winnerMentions = newWinners.map(id => `<@${id}>`).join(', ');
      await channel.send(`🎉 New winners for **${giveaway.title}**: ${winnerMentions}!`);
    } else {
      await channel.send(`😔 No valid participants for reroll of **${giveaway.title}**.`);
    }

    return embeds.success(message, `Giveaway **${giveaway.title}** has been rerolled!`);

  } catch (error) {
    console.error('Error rerolling giveaway:', error);
    return embeds.deny(message, 'Failed to reroll giveaway. Please check my permissions.');
  }
}

// Edit giveaway subcommand
async function handleEdit(client, message, args) {
  if (!args[0]) {
    return embeds.warn(message, 'Usage: `giveaways edit [level/role/host/description/image] [message_link] [value]`');
  }

  const editType = args[0].toLowerCase();
  const validEditTypes = ['level', 'role', 'host', 'description', 'image'];

  if (!validEditTypes.includes(editType)) {
    return embeds.warn(message, `Invalid edit type. Valid options: ${validEditTypes.join(', ')}`);
  }

  if (!args[1]) {
    return embeds.warn(message, 'Please provide a **message link** to the giveaway you want to edit');
  }

  const linkData = parseMessageLink(args[1]);
  if (!linkData) {
    return embeds.warn(message, 'Invalid message link format');
  }

  if (linkData.guildId !== message.guild.id) {
    return embeds.warn(message, 'I can only edit giveaways from this server');
  }

  const giveaway = await guildCache.getGiveawayByMessageId(message.guild.id, linkData.messageId);
  if (!giveaway) {
    return embeds.warn(message, 'No giveaway found with that message link');
  }

  if (!giveaway.isActive) {
    return embeds.warn(message, 'Cannot edit an ended giveaway');
  }

  // Handle different edit types
  switch (editType) {
    case 'level':
      return await handleEditLevel(client, message, args.slice(2), giveaway, linkData);
    case 'role':
      return await handleEditRole(client, message, args.slice(2), giveaway, linkData);
    case 'host':
      return await handleEditHost(client, message, args.slice(2), giveaway, linkData);
    case 'description':
      return await handleEditDescription(client, message, args.slice(2), giveaway, linkData);
    case 'image':
      return await handleEditImage(client, message, args.slice(2), giveaway, linkData);
  }
}

// Helper function to update giveaway message
async function updateGiveawayMessage(giveaway, linkData, guild) {
  try {
    const channel = guild.channels.cache.get(linkData.channelId);
    if (!channel) return false;

    const giveawayMessage = await channel.messages.fetch(linkData.messageId);
    if (!giveawayMessage) return false;

    const updatedEmbed = createGiveawayEmbed(giveaway, guild);
    await giveawayMessage.edit({ embeds: [updatedEmbed] });
    return true;
  } catch (error) {
    console.error('Error updating giveaway message:', error);
    return false;
  }
}

// Edit level requirement
async function handleEditLevel(client, message, args, giveaway, linkData) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a **level requirement** (or "none" to remove)');
  }

  let levelRequirement = null;
  if (args[0].toLowerCase() !== 'none') {
    const level = parseInt(args[0]);
    if (isNaN(level) || level < 1 || level > 1000) {
      return embeds.warn(message, 'Level requirement must be between **1** and **1000**');
    }
    levelRequirement = level;
  }

  try {
    // Update giveaway in database
    const updatedGiveaway = await guildCache.updateGiveaway(message.guild.id, giveaway.id, {
      'requirements.level': levelRequirement
    });

    // Update the message
    const success = await updateGiveawayMessage(updatedGiveaway, linkData, message.guild);
    if (!success) {
      return embeds.warn(message, 'Failed to update giveaway message');
    }

    const levelText = levelRequirement ? `Level ${levelRequirement}+` : 'removed';
    return embeds.success(message, `Level requirement for **${giveaway.title}** set to: ${levelText}`);

  } catch (error) {
    console.error('Error editing giveaway level:', error);
    return embeds.deny(message, 'Failed to update giveaway level requirement');
  }
}

// Edit role requirement
async function handleEditRole(client, message, args, giveaway, linkData) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a **role** (or "none" to remove)');
  }

  let roleRequirement = null;
  if (args[0].toLowerCase() !== 'none') {
    const roleResult = await findRole(message.guild, args[0], client);
    if (!roleResult.found) {
      return embeds.warn(message, roleResult.error);
    }
    roleRequirement = roleResult.role.id;
  }

  try {
    // Update giveaway in database
    const updatedGiveaway = await guildCache.updateGiveaway(message.guild.id, giveaway.id, {
      'requirements.roleId': roleRequirement
    });

    // Update the message
    const success = await updateGiveawayMessage(updatedGiveaway, linkData, message.guild);
    if (!success) {
      return embeds.warn(message, 'Failed to update giveaway message');
    }

    const roleText = roleRequirement ? `<@&${roleRequirement}>` : 'removed';
    return embeds.success(message, `Role requirement for **${giveaway.title}** set to: ${roleText}`);

  } catch (error) {
    console.error('Error editing giveaway role:', error);
    return embeds.deny(message, 'Failed to update giveaway role requirement');
  }
}

// Edit host
async function handleEditHost(client, message, args, giveaway, linkData) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a **user** to set as the new host');
  }

  const userResult = await findUser(message.guild, args[0], client);
  if (!userResult.found) {
    return embeds.warn(message, userResult.error);
  }

  try {
    // Update giveaway in database
    const updatedGiveaway = await guildCache.updateGiveaway(message.guild.id, giveaway.id, {
      hostId: userResult.user.user.id
    });

    // Update the message
    const success = await updateGiveawayMessage(updatedGiveaway, linkData, message.guild);
    if (!success) {
      return embeds.warn(message, 'Failed to update giveaway message');
    }

    return embeds.success(message, `Host for **${giveaway.title}** changed to: <@${userResult.user.user.id}>`);

  } catch (error) {
    console.error('Error editing giveaway host:', error);
    return embeds.deny(message, 'Failed to update giveaway host');
  }
}

// Edit description
async function handleEditDescription(client, message, args, giveaway, linkData) {
  if (!args[0]) {
    return embeds.warn(message, 'Please provide a **description** for the giveaway');
  }

  const newDescription = args.join(' ');
  if (newDescription.length > 1000) {
    return embeds.warn(message, 'Description must be **1000 characters or less**');
  }

  try {
    // Update giveaway in database
    const updatedGiveaway = await guildCache.updateGiveaway(message.guild.id, giveaway.id, {
      description: newDescription
    });

    // Update the message
    const success = await updateGiveawayMessage(updatedGiveaway, linkData, message.guild);
    if (!success) {
      return embeds.warn(message, 'Failed to update giveaway message');
    }

    return embeds.success(message, `Description for **${giveaway.title}** has been updated!`);

  } catch (error) {
    console.error('Error editing giveaway description:', error);
    return embeds.deny(message, 'Failed to update giveaway description');
  }
}

// Edit image
async function handleEditImage(client, message, args, giveaway, linkData) {
  let imageUrl = null;

  // Check for attachment first
  if (message.attachments.size > 0) {
    const attachment = message.attachments.first();
    if (attachment.contentType && attachment.contentType.startsWith('image/')) {
      imageUrl = attachment.url;
    } else {
      return embeds.warn(message, 'Attachment must be an **image**');
    }
  } else if (args[0]) {
    if (args[0].toLowerCase() === 'none') {
      imageUrl = null;
    } else {
      // Validate URL format
      try {
        new URL(args[0]);
        imageUrl = args[0];
      } catch {
        return embeds.warn(message, 'Please provide a valid **image URL** or attach an image');
      }
    }
  } else {
    return embeds.warn(message, 'Please provide an **image URL**, attach an image, or use "none" to remove');
  }

  try {
    // Update giveaway in database
    const updatedGiveaway = await guildCache.updateGiveaway(message.guild.id, giveaway.id, {
      image: imageUrl
    });

    // Update the message
    const success = await updateGiveawayMessage(updatedGiveaway, linkData, message.guild);
    if (!success) {
      return embeds.warn(message, 'Failed to update giveaway message');
    }

    const imageText = imageUrl ? 'updated' : 'removed';
    return embeds.success(message, `Image for **${giveaway.title}** has been ${imageText}!`);

  } catch (error) {
    console.error('Error editing giveaway image:', error);
    return embeds.deny(message, 'Failed to update giveaway image');
  }
}
