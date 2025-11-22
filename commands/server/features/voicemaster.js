const { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { hasDiscordPermission, isGlobalDev } = require('../../../utils/permissions');
const { getService } = require('@services');
const { colors, emojis } = require('../../../config/setup');
const logger = require('../../../utils/logger');

// Command execution tracker to prevent multiple executions
const executionTracker = new Map();

module.exports = {
  name: "voicemaster",
  aliases: ['vm', 'voice', 'vc'],
  description: 'Voice channel management system',
  isGroupCommand: true,
  run: async (client, message, args) => {
    // Initialize guildService
    const guildService = getService('guild');
    
    // Prevent multiple executions
    const executionKey = `${message.author.id}-${message.guild.id}-${Date.now()}`;
    const lastExecution = executionTracker.get(message.author.id);

    if (lastExecution && Date.now() - lastExecution < 2000) {
      return; // Ignore if executed within last 2 seconds
    }

    executionTracker.set(message.author.id, Date.now());

    // Clean up old entries
    setTimeout(() => {
      executionTracker.delete(message.author.id);
    }, 5000);

    // Show help embed if no arguments
    if (!args[0]) {
      const { runHelpCommand } = require('../../../utils/commandProcessor');
      return runHelpCommand(message, 'voicemaster');
    }

    const subcommand = args[0].toLowerCase();

    // Setup and Reset commands - require Manage Channels permission
    if (subcommand === 'setup' || subcommand === 'reset') {
      if (!hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;

      if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return embeds.deny(message, 'I need **Manage Channels** permission to manage voice manager');
      }

      if (subcommand === 'setup') {
        const subcommandInfo = {
          description: 'Setup the VoiceMaster system',
          usage: '{guildprefix}voicemaster setup',
          aliases: [],
          example: '{guildprefix}voicemaster setup'
        };
        return await handleSetupCommand(message, client);
      } else if (subcommand === 'reset') {
        const subcommandInfo = {
          description: 'Reset the VoiceMaster system',
          usage: '{guildprefix}voicemaster reset',
          aliases: [],
          example: '{guildprefix}voicemaster reset'
        };
        return await handleResetCommand(message);
      }
    }

    // All other commands require the user to be in a voice channel
    const member = message.member;
    if (!member.voice.channel) {
      return embeds.warn(message, 'You must be in a voice channel to use this command');
    }

    const voiceManager = await guildService.getVoiceManager(message.guild.id);
    if (!voiceManager.enabled) {
      return embeds.warn(message, 'Voice manager is not setup in this server. Use `,vm setup` first.');
    }

    const tempChannel = await guildService.getTempVoiceChannel(message.guild.id, member.voice.channel.id);
    if (!tempChannel) {
      return embeds.warn(message, 'You can only use this command in a temporary voice channel created by the bot');
    }

    // Check if user is the owner of the channel (except for claim command)
    if (subcommand !== 'claim' && tempChannel.ownerId !== member.id && !isGlobalDev(member.id)) {
      return embeds.warn(message, 'Only the channel owner can use this command');
    }

    // Handle different subcommands
    switch (subcommand) {
      case 'lock': {
        const subcommandInfo = {
          description: 'Lock your voice channel',
          usage: '{guildprefix}voicemaster lock',
          aliases: [],
          parameters: [],
          example: '{guildprefix}voicemaster lock'
        };
        await handleLockCommand(message, tempChannel);
        break;
      }
      case 'unlock': {
        const subcommandInfo = {
          description: 'Unlock your voice channel',
          usage: '{guildprefix}voicemaster unlock',
          aliases: [],
          parameters: [],
          example: '{guildprefix}voicemaster unlock'
        };
        await handleUnlockCommand(message, tempChannel);
        break;
      }
      case 'hide':
      case 'ghost': {
        const subcommandInfo = {
          description: 'Hide your voice channel',
          usage: '{guildprefix}voicemaster hide',
          aliases: ['ghost'],
          parameters: [],
          example: '{guildprefix}voicemaster ghost'
        };
        await handleHideCommand(message, tempChannel);
        break;
      }
      case 'unhide':
      case 'unghost': {
        const subcommandInfo = {
          description: 'Unhide your voice channel',
          usage: '{guildprefix}voicemaster unhide',
          aliases: ['unghost'],
          parameters: [],
          example: '{guildprefix}voicemaster unghost'
        };
        await handleUnhideCommand(message, tempChannel);
        break;
      }
      case 'increase': {
        const subcommandInfo = {
          description: 'Increase user limit by 1',
          usage: '{guildprefix}voicemaster increase',
          aliases: [],
          parameters: [],
          example: '{guildprefix}voicemaster increase'
        };
        await handleIncreaseCommand(message, tempChannel);
        break;
      }
      case 'decrease': {
        const subcommandInfo = {
          description: 'Decrease user limit by 1',
          usage: '{guildprefix}voicemaster decrease',
          aliases: [],
          parameters: [],
          example: '{guildprefix}voicemaster decrease'
        };
        await handleDecreaseCommand(message, tempChannel);
        break;
      }
      case 'limit': {
        const subcommandInfo = {
          description: 'Set user limit (0-99)',
          usage: '{guildprefix}voicemaster limit [number]',
          aliases: [],
          parameters: ['number'],
          example: '{guildprefix}voicemaster limit 5'
        };
        await handleLimitCommand(message, args, tempChannel);
        break;
      }
      case 'name':
      case 'rename': {
        const subcommandInfo = {
          description: 'Change your channel name',
          usage: '{guildprefix}voicemaster rename [name]',
          aliases: ['name'],
          parameters: ['name'],
          example: '{guildprefix}voicemaster rename My Cool Channel'
        };
        await handleNameCommand(message, args, tempChannel);
        break;
      }
      case 'kick':
      case 'disconnect': {
        const subcommandInfo = {
          description: 'Disconnect a user from your channel',
          usage: '{guildprefix}voicemaster kick [@user]',
          aliases: ['disconnect'],
          parameters: ['user'],
          example: '{guildprefix}voicemaster kick @vwsn'
        };
        await handleDisconnectCommand(message, args, tempChannel);
        break;
      }
      case 'invite': {
        const subcommandInfo = {
          description: 'Invite a user to your channel',
          usage: '{guildprefix}voicemaster invite [@user]',
          aliases: [],
          parameters: ['user'],
          example: '{guildprefix}voicemaster invite @vwsn'
        };
        await handleInviteCommand(message, args, tempChannel);
        break;
      }
      case 'reject': {
        const subcommandInfo = {
          description: 'Reject a user from your channel',
          usage: '{guildprefix}voicemaster reject [@user]',
          aliases: [],
          parameters: ['user'],
          example: '{guildprefix}voicemaster reject @vwsn'
        };
        await handleRejectCommand(message, args, tempChannel);
        break;
      }
      case 'permit': {
        const subcommandInfo = {
          description: 'Permit a user to access your channel',
          usage: '{guildprefix}voicemaster permit [@user]',
          aliases: [],
          parameters: ['user'],
          example: '{guildprefix}voicemaster permit @vwsn'
        };
        await handlePermitCommand(message, args, tempChannel);
        break;
      }
      case 'status': {
        const subcommandInfo = {
          description: 'Set your channel status',
          usage: '{guildprefix}voicemaster status [text]',
          aliases: [],
          parameters: ['text'],
          example: '{guildprefix}voicemaster status Playing games!'
        };
        await handleStatusCommand(message, args, tempChannel);
        break;
      }
      case 'transfer': {
        const subcommandInfo = {
          description: 'Transfer ownership to another user',
          usage: '{guildprefix}voicemaster transfer [@user]',
          aliases: [],
          parameters: ['user'],
          example: '{guildprefix}voicemaster transfer @vwsn'
        };
        await handleTransferCommand(message, args, tempChannel);
        break;
      }
      case 'claim': {
        const subcommandInfo = {
          description: 'Claim ownership of an abandoned channel',
          usage: '{guildprefix}voicemaster claim',
          aliases: [],
          parameters: [],
          example: '{guildprefix}voicemaster claim'
        };
        await handleClaimCommand(message, tempChannel);
        break;
      }
      default:
        return false;
    }
  }
};

// Setup command handler
async function handleSetupCommand(message, client) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  const voiceManager = await guildService.getVoiceManager(message.guild.id);
  if (voiceManager.enabled) {
    return embeds.warn(message, 'Voice manager is already setup in this server. Use `,vm reset` to recreate.');
  }

  try {
    // Create voice category
    const category = await message.guild.channels.create({
      name: 'Voice Channels',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: message.guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
        }
      ]
    });

    // Create "Join 2 create" voice channel
    const joinChannel = await message.guild.channels.create({
      name: 'Join 2 create',
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: message.guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
        }
      ]
    });

    // Create "menu" text channel
    const menuChannel = await message.guild.channels.create({
      name: 'menu',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: message.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.SendMessages],
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
        }
      ]
    });

    // Save configuration to database
    await guildService.setupVoiceManager(
      message.guild.id,
      category.id,
      joinChannel.id,
      menuChannel.id
    );

    // Create voice manager panel
    await createVoiceManagerPanel(client, menuChannel);

    return embeds.success(message, 'Finished setting up the VoiceMaster channels. A category and two channels have been created.');

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'Failed to setup voice manager. Please check my permissions and try again.');
  }
}

// Reset command handler
async function handleResetCommand(message) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  const voiceManager = await guildService.getVoiceManager(message.guild.id);
  if (!voiceManager.enabled) {
    return embeds.warn(message, 'Voice manager is not setup in this server. Use `,vm setup` first.');
  }

  try {
    // Delete all existing temporary channels first
    for (const tempChannel of voiceManager.tempChannels || []) {
      try {
        const channel = message.guild.channels.cache.get(tempChannel.channelId);
        if (channel) {
          await channel.delete('Voice manager reset');
        }
      } catch (error) {
        // Continue if channel deletion fails
      }
    }

    // Delete existing setup channels and category
    const channels = [voiceManager.joinChannelId, voiceManager.mutedChannelId, voiceManager.categoryId];
    for (const channelId of channels) {
      try {
        const channel = message.guild.channels.cache.get(channelId);
        if (channel) {
          await channel.delete('Voice manager reset');
        }
      } catch (error) {
        // Continue if channel deletion fails
      }
    }

    // Clear database configuration
    await guildService.disableVoiceManager(message.guild.id);

    return embeds.success(message, 'Voice manager has been reset. Use `,vm setup` to create a new voice manager system.');

  } catch (error) {
    logger.webhook.error(error, message);
    return embeds.deny(message, 'Failed to reset voice manager. Please check my permissions and try again.');
  }
}

// Create voice manager panel with buttons
async function createVoiceManagerPanel(client, channel) {
  const panelEmbed = new EmbedBuilder()
    .setTitle('**VoiceMaster Interface**')
    .setDescription(
      '-# Use the buttons below to control your voice channel.\n\n' +
      '**Button Usage:**\n' +
      '> [**`Lock`**](https://dsc.gg/s-invite) the voice channel\n' +
      '> [**`Unlock`**](https://dsc.gg/s-invite) the voice channel\n' +
      '> [**`Ghost`**](https://dsc.gg/s-invite) the voice channel\n' +
      '> [**`Reveal`**](https://dsc.gg/s-invite) the voice channel\n' +
      '> [**`Increase`**](https://dsc.gg/s-invite) the user limit\n' +
      '> [**`Decrease`**](https://dsc.gg/s-invite) the user limit\n' +
      '> [**`Rename`**](https://dsc.gg/s-invite) the voice channel\n' +
      '> [**`Info`**](https://dsc.gg/s-invite) channel information'
    )
    .setColor(colors.embed)
    .setThumbnail(client.user.displayAvatarURL());

  // Create button rows - 4 buttons per row (8 total)
  // Using custom emojis from config
  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('vm_lock')
        .setEmoji(emojis.vmLock)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vm_unlock')
        .setEmoji(emojis.vmUnlock)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vm_hide')
        .setEmoji(emojis.vmHide)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vm_unhide')
        .setEmoji(emojis.vmUnhide)
        .setStyle(ButtonStyle.Secondary)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('vm_increase')
        .setLabel('Increase')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vm_decrease')
        .setLabel('Decrease')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vm_rename')
        .setLabel('Rename')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vm_info')
        .setLabel('Info')
        .setStyle(ButtonStyle.Secondary)
    );

  try {
    await channel.send({
      embeds: [panelEmbed],
      components: [row1, row2]
    });
  } catch (error) {
    console.error('Failed to create voice manager panel:', error);
    // Fallback with labels only if emojis still fail
    const fallbackRow1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('vm_lock')
          .setLabel('Lock')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_unlock')
          .setLabel('Unlock')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_hide')
          .setLabel('Hide')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_unhide')
          .setLabel('Unhide')
          .setStyle(ButtonStyle.Secondary)
      );

    const fallbackRow2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('vm_increase')
          .setLabel('Increase')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_decrease')
          .setLabel('Decrease')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_rename')
          .setLabel('Rename')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_info')
          .setLabel('Info')
          .setStyle(ButtonStyle.Secondary)
      );

    await channel.send({
      embeds: [panelEmbed],
      components: [fallbackRow1, fallbackRow2]
    });
    console.log('Voice manager panel created with fallback buttons');
  }
}

// Command handlers
async function handleLockCommand(message, tempChannel) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  if (tempChannel.settings.locked) {
    return embeds.warn(message, 'Your voice channel is already locked');
  }

  try {
    await message.member.voice.channel.permissionOverwrites.edit(message.guild.roles.everyone.id, {
      Connect: false
    });

    await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      locked: true
    });

    return embeds.success(message, 'Locked your voice channel');
  } catch (error) {
    return embeds.deny(message, 'Failed to lock the voice channel. Please check my permissions.');
  }
}

async function handleUnlockCommand(message, tempChannel) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  if (!tempChannel.settings.locked) {
    return embeds.warn(message, 'Your voice channel is not locked');
  }

  try {
    await message.member.voice.channel.permissionOverwrites.edit(message.guild.roles.everyone.id, {
      Connect: true
    });

    await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      locked: false
    });

    return embeds.success(message, 'Unlocked your voice channel');
  } catch (error) {
    return embeds.deny(message, 'Failed to unlock the voice channel. Please check my permissions.');
  }
}

async function handleHideCommand(message, tempChannel) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  if (tempChannel.settings.hidden) {
    return embeds.warn(message, 'Your voice channel is already hidden');
  }

  try {
    await message.member.voice.channel.permissionOverwrites.edit(message.guild.roles.everyone.id, {
      ViewChannel: false
    });

    await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      hidden: true
    });

    return embeds.success(message, 'Hidden your voice channel');
  } catch (error) {
    return embeds.deny(message, 'Failed to hide the voice channel. Please check my permissions.');
  }
}

async function handleUnhideCommand(message, tempChannel) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  if (!tempChannel.settings.hidden) {
    return embeds.warn(message, 'Your voice channel is not hidden');
  }

  try {
    await message.member.voice.channel.permissionOverwrites.edit(message.guild.roles.everyone.id, {
      ViewChannel: true
    });

    await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      hidden: false
    });

    return embeds.success(message, 'Unhidden your voice channel');
  } catch (error) {
    return embeds.deny(message, 'Failed to unhide the voice channel. Please check my permissions.');
  }
}

async function handleIncreaseCommand(message, tempChannel) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  const currentLimit = tempChannel.settings.userLimit || 0;
  const newLimit = currentLimit === 0 ? 2 : Math.min(currentLimit + 1, 99);

  try {
    await message.member.voice.channel.setUserLimit(newLimit);
    await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      userLimit: newLimit
    });

    return embeds.success(message, `Increased user limit to **${newLimit}**`);
  } catch (error) {
    return embeds.deny(message, 'Failed to increase user limit. Please check my permissions.');
  }
}

async function handleDecreaseCommand(message, tempChannel) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  const currentLimit = tempChannel.settings.userLimit || 0;
  if (currentLimit <= 1) {
    return embeds.warn(message, 'User limit is already at minimum (1) or unlimited (0)');
  }

  const newLimit = currentLimit - 1;

  try {
    await message.member.voice.channel.setUserLimit(newLimit);
    await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      userLimit: newLimit
    });

    return embeds.success(message, `Decreased user limit to **${newLimit}**`);
  } catch (error) {
    return embeds.deny(message, 'Failed to decrease user limit. Please check my permissions.');
  }
}

async function handleLimitCommand(message, args, tempChannel) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  const limit = parseInt(args[1]);

  if (isNaN(limit) || limit < 0 || limit > 99) {
    return embeds.warn(message, 'Please provide a valid limit between 0-99: `,vm limit 5`\nUse 0 for no limit.');
  }

  try {
    await message.member.voice.channel.setUserLimit(limit);
    await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      userLimit: limit
    });

    const limitText = limit === 0 ? 'Removed user limit' : `Set user limit to **${limit}**`;
    return embeds.success(message, limitText);
  } catch (error) {
    return embeds.deny(message, 'Failed to set user limit. Please check my permissions.');
  }
}

async function handleNameCommand(message, args, tempChannel) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  const newName = args.slice(1).join(' ');

  if (!newName) {
    return embeds.warn(message, 'Please provide a new name: `,vm rename My Cool Channel`');
  }

  if (newName.length > 100) {
    return embeds.warn(message, 'Channel name must be 100 characters or less');
  }

  try {
    await message.member.voice.channel.setName(newName);
    await guildService.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      customName: newName
    });

    return embeds.success(message, `Voice channel name changed to: **${newName}**`);
  } catch (error) {
    return embeds.deny(message, 'Failed to change channel name. Please check my permissions.');
  }
}

async function handleDisconnectCommand(message, args, tempChannel) {
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return embeds.warn(message, 'Please mention a user to kick: `,vm kick @user`');
  }

  if (targetUser.id === message.author.id) {
    return embeds.warn(message, 'You cannot kick yourself');
  }

  const targetMember = message.guild.members.cache.get(targetUser.id);
  if (!targetMember) {
    return embeds.warn(message, 'User not found in this server');
  }

  if (!targetMember.voice.channel || targetMember.voice.channel.id !== tempChannel.channelId) {
    return embeds.warn(message, 'User is not in your voice channel');
  }

  try {
    await targetMember.voice.disconnect('Kicked by channel owner');
    return embeds.success(message, `Kicked **${targetUser.username}** from your voice channel`);
  } catch (error) {
    return embeds.deny(message, 'Failed to kick the user. Please check my permissions.');
  }
}

async function handleInviteCommand(message, args, tempChannel) {
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return embeds.warn(message, 'Please mention a user to invite: `,vm invite @user`');
  }

  if (targetUser.id === message.author.id) {
    return embeds.warn(message, 'You cannot invite yourself');
  }

  if (targetUser.bot) {
    return embeds.warn(message, 'You cannot invite bots');
  }

  try {
    // Give the user permission to join the channel
    await message.member.voice.channel.permissionOverwrites.edit(targetUser.id, {
      Connect: true,
      ViewChannel: true
    });

    return embeds.success(message, `Granted **${targetUser.username}** access to your voice channel`);
  } catch (error) {
    return embeds.deny(message, `Failed to invite ${targetUser.username}. Please check my permissions.`);
  }
}

async function handleRejectCommand(message, args, tempChannel) {
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return embeds.warn(message, 'Please mention a user to reject: `,vm reject @user`');
  }

  if (targetUser.id === message.author.id) {
    return embeds.warn(message, 'You cannot reject yourself');
  }

  const targetMember = message.guild.members.cache.get(targetUser.id);
  if (!targetMember) {
    return embeds.warn(message, 'User not found in this server');
  }

  try {
    // Disconnect if in channel
    if (targetMember.voice.channel && targetMember.voice.channel.id === tempChannel.channelId) {
      await targetMember.voice.disconnect('Rejected by channel owner');
    }

    // Add permission override to deny access
    await message.member.voice.channel.permissionOverwrites.edit(targetUser.id, {
      Connect: false,
      ViewChannel: false
    });

    return embeds.success(message, `Rejected **${targetUser.username}** from your voice channel`);
  } catch (error) {
    return embeds.deny(message, 'Failed to reject the user. Please check my permissions.');
  }
}

async function handlePermitCommand(message, args, tempChannel) {
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return embeds.warn(message, 'Please mention a user to permit: `,vm permit @user`');
  }

  if (targetUser.id === message.author.id) {
    return embeds.warn(message, 'You cannot permit yourself');
  }

  try {
    // Remove permission override to allow access
    await message.member.voice.channel.permissionOverwrites.edit(targetUser.id, {
      Connect: true,
      ViewChannel: true
    });

    return embeds.success(message, `Permitted **${targetUser.username}** to access your voice channel`);
  } catch (error) {
    return embeds.deny(message, 'Failed to permit the user. Please check my permissions.');
  }
}

async function handleStatusCommand(message, args, tempChannel) {
  const newStatus = args.slice(1).join(' ');

  if (!newStatus) {
    return embeds.warn(message, 'Please provide a status: `,vm status Playing games!`');
  }

  if (newStatus.length > 1024) {
    return embeds.warn(message, 'Channel status must be 1024 characters or less');
  }

  try {
    await message.member.voice.channel.setTopic(newStatus);
    return embeds.success(message, `Voice channel status changed to: **${newStatus}**`);
  } catch (error) {
    return embeds.deny(message, 'Failed to change channel status. Please check my permissions.');
  }
}

async function handleTransferCommand(message, args, tempChannel) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return embeds.warn(message, 'Please mention a user to transfer ownership to: `,vm transfer @user`');
  }

  if (targetUser.id === message.author.id) {
    return embeds.warn(message, 'You cannot transfer ownership to yourself');
  }

  if (targetUser.bot) {
    return embeds.warn(message, 'You cannot transfer ownership to bots');
  }

  const targetMember = message.guild.members.cache.get(targetUser.id);
  if (!targetMember) {
    return embeds.warn(message, 'User not found in this server');
  }

  if (!targetMember.voice.channel || targetMember.voice.channel.id !== tempChannel.channelId) {
    return embeds.warn(message, 'User must be in your voice channel to transfer ownership');
  }

  try {
    await guildService.transferVoiceChannelOwnership(message.guild.id, tempChannel.channelId, targetUser.id);
    return embeds.success(message, `Voice channel ownership transferred to ${targetUser.username}`);
  } catch (error) {
    return embeds.deny(message, 'Failed to transfer ownership');
  }
}

async function handleClaimCommand(message, tempChannel) {
  const { getService } = require('@services');
  const guildService = getService('guild');
  // Check if current owner is still in the channel
  const currentOwner = message.guild.members.cache.get(tempChannel.ownerId);
  if (currentOwner && currentOwner.voice.channel && currentOwner.voice.channel.id === tempChannel.channelId) {
    return embeds.warn(message, 'Cannot claim this channel while the owner is still present');
  }

  try {
    await guildService.transferVoiceChannelOwnership(message.guild.id, tempChannel.channelId, message.author.id);
    return embeds.success(message, 'You have claimed ownership of this voice channel');
  } catch (error) {
    return embeds.deny(message, 'Failed to claim ownership');
  }
}