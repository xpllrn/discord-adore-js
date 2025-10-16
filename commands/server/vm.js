const { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasDiscordPermission, isGlobalDev } = require('../../utils/permissions');
const guildCache = require('../../database/cache/models/guild');
const { colors, emojis } = require('../../config/setup');

module.exports = {
  name: "vm",
  aliases: ['voicemanager', 'voice'],
  description: 'Voice channel management system',
  usage: `{guildprefix}vm setup
{guildprefix}vm reset
{guildprefix}vm lock
{guildprefix}vm unlock
{guildprefix}vm hide
{guildprefix}vm unhide
{guildprefix}vm invite @user
{guildprefix}vm disconnect @user
{guildprefix}vm limit [number]
{guildprefix}vm reject @user
{guildprefix}vm permit @user
{guildprefix}vm name [name]
{guildprefix}vm status [status]
{guildprefix}vm transfer @user
{guildprefix}vm claim`,
  permission: 'Manage Channels',
  run: async(client, message, args) => {

    // Show help embed if no arguments
    if (!args[0]) {
      return await showVMHelp(message);
    }

    const subcommand = args[0].toLowerCase();

    // Setup and Reset commands - require Manage Channels permission
    if (subcommand === 'setup' || subcommand === 'reset') {
      if (!hasDiscordPermission(message, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return;

      if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return embeds.deny(message, 'I need **Manage Channels** permission to manage voice manager');
      }

      if (subcommand === 'setup') {
        return await handleSetupCommand(message);
      } else if (subcommand === 'reset') {
        return await handleResetCommand(message);
      }
    }



    // All other commands require the user to be in a temporary voice channel
    const member = message.member;
    if (!member.voice.channel) {
      return embeds.warn(message, 'You need to be in a voice channel to use this command');
    }

    const voiceManager = await guildCache.getVoiceManager(message.guild.id);
    if (!voiceManager.enabled) {
      return embeds.warn(message, 'Voice manager is not setup in this server. Use `,vm setup` first.');
    }

    const tempChannel = await guildCache.getTempVoiceChannel(message.guild.id, member.voice.channel.id);
    if (!tempChannel) {
      return embeds.warn(message, 'You can only use voice manager commands in temporary voice channels');
    }

    // Check if user is the owner of the channel (except for claim command)
    // DEV_ID user bypasses ownership checks
    if (subcommand !== 'claim' && tempChannel.ownerId !== member.id && !isGlobalDev(member.id)) {
      // Debug information for troubleshooting
      console.log(`[VM Debug] User ${member.id} tried to use ${subcommand} but is not owner. Channel owner: ${tempChannel.ownerId}, Is Dev: ${isGlobalDev(member.id)}`);
      return embeds.warn(message, `Only the channel owner can use this command. (Debug: Owner: ${tempChannel.ownerId}, You: ${member.id})`);
    }

    // Handle different subcommands
    switch (subcommand) {
      case 'lock':
        await handleLockCommand(message, tempChannel);
        break;
      case 'unlock':
        await handleUnlockCommand(message, tempChannel);
        break;
      case 'hide':
        await handleHideCommand(message, tempChannel);
        break;
      case 'unhide':
        await handleUnhideCommand(message, tempChannel);
        break;
      case 'invite':
        await handleInviteCommand(message, args, tempChannel);
        break;
      case 'disconnect':
        await handleDisconnectCommand(message, args, tempChannel);
        break;
      case 'limit':
        await handleLimitCommand(message, args, tempChannel);
        break;
      case 'reject':
        await handleRejectCommand(message, args, tempChannel);
        break;
      case 'permit':
        await handlePermitCommand(message, args, tempChannel);
        break;
      case 'name':
        await handleNameCommand(message, args, tempChannel);
        break;
      case 'status':
        await handleStatusCommand(message, args, tempChannel);
        break;
      case 'transfer':
        await handleTransferCommand(message, args, tempChannel);
        break;
      case 'claim':
        await handleClaimCommand(message, tempChannel);
        break;
      default:
        return false;
    }
  }
};

// Lock command handler
async function handleLockCommand(message, tempChannel) {
  if (tempChannel.settings.locked) {
    return embeds.warn(message, 'Your voice channel is already locked');
  }

  try {
    await message.member.voice.channel.permissionOverwrites.edit(message.guild.roles.everyone.id, {
      Connect: false
    });

    await guildCache.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      locked: true
    });

    return embeds.success(message, 'Locked your voice channel');
  } catch (error) {
    return embeds.deny(message, 'Failed to lock the voice channel. Please check my permissions.');
  }
}

// Unlock command handler
async function handleUnlockCommand(message, tempChannel) {
  if (!tempChannel.settings.locked) {
    return embeds.warn(message, 'Your voice channel is not locked');
  }

  try {
    await message.member.voice.channel.permissionOverwrites.edit(message.guild.roles.everyone.id, {
      Connect: true
    });

    await guildCache.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      locked: false
    });

    return embeds.success(message, 'Unlocked your voice channel');
  } catch (error) {
    return embeds.deny(message, 'Failed to unlock the voice channel. Please check my permissions.');
  }
}

// Hide command handler
async function handleHideCommand(message, tempChannel) {
  if (tempChannel.settings.hidden) {
    return embeds.warn(message, 'Your voice channel is already hidden');
  }

  try {
    await message.member.voice.channel.permissionOverwrites.edit(message.guild.roles.everyone.id, {
      ViewChannel: false
    });

    await guildCache.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      hidden: true
    });

    return embeds.success(message, 'Hidden your voice channel');
  } catch (error) {
    return embeds.deny(message, 'Failed to hide the voice channel. Please check my permissions.');
  }
}

// Unhide command handler
async function handleUnhideCommand(message, tempChannel) {
  if (!tempChannel.settings.hidden) {
    return embeds.warn(message, 'Your voice channel is not hidden');
  }

  try {
    await message.member.voice.channel.permissionOverwrites.edit(message.guild.roles.everyone.id, {
      ViewChannel: true
    });

    await guildCache.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      hidden: false
    });

    return embeds.success(message, 'Unhidden your voice channel');
  } catch (error) {
    return embeds.deny(message, 'Failed to unhide the voice channel. Please check my permissions.');
  }
}

// Invite command handler
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

  // Check cooldown
  const cooldownResult = await guildCache.checkInviteCooldown(message.guild.id, message.author.id, targetUser.id);
  if (!cooldownResult.canInvite) {
    const timeLeft = Math.ceil(cooldownResult.timeLeft / 1000 / 60);
    return embeds.warn(message, `You can invite ${targetUser.username} again in ${timeLeft} minutes`);
  }

  try {
    // Automatically permit the user to the channel
    const permittedUsers = [...(tempChannel.settings.permittedUsers || [])];
    if (!permittedUsers.includes(targetUser.id)) {
      permittedUsers.push(targetUser.id);
      await guildCache.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
        permittedUsers: permittedUsers
      });
    }

    // Give the user permission to join the channel
    await message.member.voice.channel.permissionOverwrites.edit(targetUser.id, {
      Connect: true,
      ViewChannel: true
    });

    // Try to send DM invitation
    let dmSent = false;
    try {
      const inviteEmbed = embeds.embed()
        .setTitle('Voice Channel Invitation')
        .setDescription(`**${message.author.username}** would like to invite you to their voice channel!`)
        .addFields([
          { name: 'Server', value: message.guild.name, inline: true },
          { name: 'Channel', value: message.member.voice.channel.name, inline: true },
          { name: 'Invited by', value: message.author.username, inline: true }
        ])
        .setColor(colors.success)
        .setTimestamp();

      await targetUser.send({ embeds: [inviteEmbed] });
      dmSent = true;
    } catch (dmError) {
      // DM failed, but we'll still permit them
    }

    // Add cooldown
    await guildCache.addInviteCooldown(message.guild.id, message.author.id, targetUser.id, message.member.voice.channel.id);

    const successMessage = dmSent
      ? `Sent invitation to **${targetUser.username}** and granted them access to your voice channel`
      : `Granted **${targetUser.username}** access to your voice channel (couldn't send DM - they may have DMs disabled)`;

    return embeds.success(message, successMessage);
  } catch (error) {
    return embeds.deny(message, `Failed to invite ${targetUser.username}. Please check my permissions.`);
  }
}

// Disconnect command handler
async function handleDisconnectCommand(message, args, tempChannel) {
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return embeds.warn(message, 'Please mention a user to disconnect: `,vm disconnect @user`');
  }

  if (targetUser.id === message.author.id) {
    return embeds.warn(message, 'You cannot disconnect yourself');
  }

  const targetMember = message.guild.members.cache.get(targetUser.id);
  if (!targetMember) {
    return embeds.warn(message, 'User not found in this server');
  }

  if (!targetMember.voice.channel || targetMember.voice.channel.id !== tempChannel.channelId) {
    return embeds.warn(message, 'User is not in your voice channel');
  }

  try {
    await targetMember.voice.disconnect('Disconnected by channel owner');
    return embeds.success(message, `Disconnected **${targetUser.username}** from your voice channel`);
  } catch (error) {
    return embeds.deny(message, 'Failed to disconnect the user. Please check my permissions.');
  }
}

// Limit command handler
async function handleLimitCommand(message, args, tempChannel) {
  const limit = parseInt(args[1]);

  if (isNaN(limit) || limit < 0 || limit > 99) {
    return embeds.warn(message, 'Please provide a valid limit between 0-99: `,vm limit 5`\nUse 0 for no limit.');
  }

  try {
    await message.member.voice.channel.setUserLimit(limit);

    await guildCache.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      userLimit: limit
    });

    const limitText = limit === 0 ? 'Removed user limit' : `Set user limit to **${limit}**`;
    return embeds.success(message, limitText);
  } catch (error) {
    return embeds.deny(message, 'Failed to set user limit. Please check my permissions.');
  }
}

// Reject command handler
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

    // Add to rejected users list
    const rejectedUsers = [...tempChannel.settings.rejectedUsers];
    if (!rejectedUsers.includes(targetUser.id)) {
      rejectedUsers.push(targetUser.id);
    }

    await guildCache.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      rejectedUsers: rejectedUsers
    });

    return embeds.success(message, `Rejected **${targetUser.username}** from your voice channel`);
  } catch (error) {
    return embeds.deny(message, 'Failed to reject the user. Please check my permissions.');
  }
}

// Permit command handler
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

    // Remove from rejected users list
    const rejectedUsers = tempChannel.settings.rejectedUsers.filter(id => id !== targetUser.id);

    // Add to permitted users list
    const permittedUsers = [...tempChannel.settings.permittedUsers];
    if (!permittedUsers.includes(targetUser.id)) {
      permittedUsers.push(targetUser.id);
    }

    await guildCache.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      rejectedUsers: rejectedUsers,
      permittedUsers: permittedUsers
    });

    return embeds.success(message, `Permitted **${targetUser.username}** to access your voice channel`);
  } catch (error) {
    return embeds.deny(message, 'Failed to permit the user. Please check my permissions.');
  }
}

// Name command handler
async function handleNameCommand(message, args, tempChannel) {
  const newName = args.slice(1).join(' ');

  if (!newName) {
    return embeds.warn(message, 'Please provide a new name: `,vm name My Cool Channel`');
  }

  if (newName.length > 100) {
    return embeds.warn(message, 'Channel name must be 100 characters or less');
  }

  try {
    await message.member.voice.channel.setName(newName);

    await guildCache.updateTempVoiceChannel(message.guild.id, tempChannel.channelId, {
      customName: newName
    });

    return embeds.success(message, `Voice channel name changed to: **${newName}**`);
  } catch (error) {
    return embeds.deny(message, 'Failed to change channel name. Please check my permissions.');
  }
}

// Status command handler (sets channel topic)
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

// Transfer command handler
async function handleTransferCommand(message, args, tempChannel) {
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
    await guildCache.transferVoiceChannelOwnership(message.guild.id, tempChannel.channelId, targetUser.id);
    return embeds.success(message, `Voice channel ownership transferred to ${targetUser.username}`);
  } catch (error) {
    return embeds.deny(message, 'Failed to transfer ownership');
  }
}

// Claim command handler
async function handleClaimCommand(message, tempChannel) {
  // Check if current owner is still in the channel
  const currentOwner = message.guild.members.cache.get(tempChannel.ownerId);
  if (currentOwner && currentOwner.voice.channel && currentOwner.voice.channel.id === tempChannel.channelId) {
    return embeds.warn(message, 'Cannot claim this channel while the owner is still present');
  }

  try {
    await guildCache.transferVoiceChannelOwnership(message.guild.id, tempChannel.channelId, message.author.id);
    return embeds.success(message, 'You have claimed ownership of this voice channel');
  } catch (error) {
    return embeds.deny(message, 'Failed to claim ownership');
  }
}

// Setup command handler
async function handleSetupCommand(message) {
  // Check if voice manager is already setup
  const voiceManager = await guildCache.getVoiceManager(message.guild.id);
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
    await guildCache.setupVoiceManager(
      message.guild.id,
      category.id,
      joinChannel.id,
      menuChannel.id
    );

    // Create voice manager panel
    await createVoiceManagerPanel(message.client, menuChannel);

    return embeds.success(message, `Finished setting up the VoiceMaster channels. A category and two channels have been created, you can move the channels or rename them if you want.`);

  } catch (error) {
    console.error('VM Setup Error:', error);
    return embeds.deny(message, 'Failed to setup voice manager. Please check my permissions and try again.');
  }
}

// Reset command handler
async function handleResetCommand(message) {
  const voiceManager = await guildCache.getVoiceManager(message.guild.id);
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
    await guildCache.disableVoiceManager(message.guild.id);

    return embeds.success(message, 'Voice manager has been reset. All channels and configuration have been removed. Use `,vm setup` to create a new voice manager system.');

  } catch (error) {
    console.error('VM Reset Error:', error);
    return embeds.deny(message, 'Failed to reset voice manager. Please check my permissions and try again.');
  }
}



// Show VM help embed
async function showVMHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(colors.embed)
    .setTitle('Voice Manager Commands')
    .setDescription('Manage your temporary voice channels with these commands:')
    .addFields([
      {
        name: '**vm lock**',
        value: '> Lock your voice channel',
        inline: true
      },
      {
        name: '**vm unlock**',
        value: '> Unlock your voice channel',
        inline: true
      },
      {
        name: '**vm hide**',
        value: '> Hide your voice channel',
        inline: true
      },
      {
        name: '**vm unhide**',
        value: '> Unhide your voice channel',
        inline: true
      },
      {
        name: '**vm invite**',
        value: '> Invite a user to your channel',
        inline: true
      },
      {
        name: '**vm disconnect**',
        value: '> Disconnect a user from your channel',
        inline: true
      },
      {
        name: '**vm limit**',
        value: '> Set user limit for your channel',
        inline: true
      },
      {
        name: '**vm reject**',
        value: '> Permanently block a user from your channel',
        inline: true
      },
      {
        name: '**vm permit**',
        value: '> Allow a blocked user back into your channel',
        inline: true
      },
      {
        name: '**vm name**',
        value: '> Change your channel name',
        inline: true
      },
      {
        name: '**vm status**',
        value: '> Set your channel status/topic',
        inline: true
      },
      {
        name: '**vm transfer**',
        value: '> Transfer ownership to another user',
        inline: true
      },
      {
        name: '**vm claim**',
        value: '> Claim ownership of an abandoned channel',
        inline: true
      }
    ]);

  return message.channel.send({ embeds: [embed] });
}

// Create voice manager panel with buttons
async function createVoiceManagerPanel(client, channel) {
  const panelEmbed = new EmbedBuilder()
    .setTitle('**Voicemaster Menu**')
    .setDescription(
      'Welcome to the Voicemaster interface! Here you can manage your voice channels with ease. Below are the available options\n\n' +
      `${emojis.vmLock} **Lock** - Lock your voice channel\n` +
      `${emojis.vmUnlock} **Unlock** - Unlock your voice channel\n` +
      `${emojis.vmHide} **Hide** - Hide your voice channel\n` +
      `${emojis.vmUnhide} **Reveal** - Reveal your hidden voice channel\n` +
      `${emojis.vmRename} **Rename** - Rename your voice channel\n` +
      `${emojis.vmClaim} **Claim** - Claim an unclaimed voice channel\n` +
      `${emojis.vmIncrease} **Increase** - Increase the user limit of your voice channel\n` +
      `${emojis.vmDecrease} **Decrease** - Decrease the user limit of your voice channel\n` +
      `${emojis.vmDelete} **Delete** - Delete your voice channel\n` +
      `${emojis.vmInfo} **Information** - View information on the current voice channel`
    )
    .setColor(colors.embed)
    .setThumbnail(client.user.displayAvatarURL());

  // Create button rows (Discord allows max 5 buttons per row)
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
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vm_rename')
        .setEmoji(emojis.vmRename)
        .setStyle(ButtonStyle.Secondary)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('vm_claim')
        .setEmoji(emojis.vmClaim)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vm_increase')
        .setEmoji(emojis.vmIncrease)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vm_decrease')
        .setEmoji(emojis.vmDecrease)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vm_delete')
        .setEmoji(emojis.vmDelete)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vm_info')
        .setEmoji(emojis.vmInfo)
        .setStyle(ButtonStyle.Secondary)
    );

  await channel.send({
    embeds: [panelEmbed],
    components: [row1, row2]
  });
}
