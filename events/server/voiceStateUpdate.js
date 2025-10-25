const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getService } = require('@services');
const webhookLogger = require('../../utils/webhookLogger');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    try {
      // Skip if no guild
      if (!newState.guild) return;

      // Log voice state changes (before skipping bots)
      await logVoiceStateChange(oldState, newState);

      // Skip bots for voice manager functionality
      if (newState.member.user.bot) return;

      const guild = newState.guild;
      const member = newState.member;
      const guildService = getService('guild');

      // Get voice manager configuration
      const voiceManager = await guildService.getVoiceManager(guild.id);
      if (!voiceManager.enabled) return;

      // Handle user joining the "Join 2 create" channel
      if (newState.channel && newState.channel.id === voiceManager.joinChannelId) {
        await handleJoinToCreate(guild, member, voiceManager);
      }

      // Handle user leaving a temporary voice channel (for auto-deletion)
      if (oldState.channel && oldState.channel.id !== voiceManager.joinChannelId) {
        await handleTempChannelLeave(guild, oldState.channel, voiceManager);
      }

      // Handle user joining a temporary voice channel (for invite tracking)
      if (newState.channel && newState.channel.id !== voiceManager.joinChannelId) {
        await handleTempChannelJoin(guild, member, newState.channel, voiceManager);
      }

    } catch (error) {
      console.error('Voice State Update Error:', error);
    }
  },
};

// Handle user joining the "Join 2 create" channel
async function handleJoinToCreate(guild, member, voiceManager) {
  try {
    const guildService = getService('guild');
    console.log(`User ${member.displayName} joined hub channel ${voiceManager.joinChannelId}. Attempting to create temporary channel.`);
    // Check if user already has a temporary channel
    const existingChannel = voiceManager.tempChannels.find(ch => ch.ownerId === member.id);
    if (existingChannel) {
      const channel = guild.channels.cache.get(existingChannel.channelId);
      if (channel) {
        // Move user to their existing channel
        await member.voice.setChannel(channel);
        return;
      } else {
        // Channel doesn't exist anymore, remove from database
        await guildService.removeTempVoiceChannel(guild.id, existingChannel.channelId);
      }
    }

    // Get the voice category
    const category = guild.channels.cache.get(voiceManager.categoryId);
    if (!category) {
      console.error('Voice Manager: Category not found');
      return;
    }

    // Check if bot has MOVE_MEMBERS permission
    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
      console.error('Bot does not have MOVE_MEMBERS permission');
      return;
    }

    // Create new temporary voice channel
    const tempChannel = await guild.channels.create({
      name: `${member.displayName}'s vc`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.Stream,
            PermissionFlagsBits.UseVAD // Voice Activity Detection
          ]
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.Stream,
            PermissionFlagsBits.UseVAD,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers
          ]
        },
        {
          id: botMember.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers
          ]
        }
      ]
    });
    console.log(`Created temp channel ${tempChannel.name} (${tempChannel.id})`);

    // Add to database
    await guildService.addTempVoiceChannel(guild.id, tempChannel.id, member.id);

    // Move user to their new channel
    console.log(`Moving user ${member.displayName} to new temp channel ${tempChannel.id}`);
    await member.voice.setChannel(tempChannel);
    console.log(`Successfully moved user ${member.displayName} to temp channel`);

  } catch (error) {
    console.error('Join to Create Error:', error);
    console.error('Error details:', error.message, error.stack);
  }
}

// Handle user leaving a temporary voice channel
async function handleTempChannelLeave(guild, channel, voiceManager) {
  try {
    const guildService = getService('guild');
    // Check if this is a temporary channel
    const tempChannel = voiceManager.tempChannels.find(ch => ch.channelId === channel.id);
    if (!tempChannel) return;

    console.log(`User left temp channel ${channel.name} (${channel.id}). Members remaining: ${channel.members.size}`);

    // Check if channel is now empty
    if (channel.members.size === 0) {
      console.log(`Temp channel ${channel.name} is empty, deleting...`);
      // Delete the channel
      await channel.delete('Temporary voice channel auto-cleanup');
      
      // Remove from database
      await guildService.removeTempVoiceChannel(guild.id, channel.id);
      console.log(`Successfully deleted temp channel ${channel.id}`);
    }

  } catch (error) {
    console.error('Temp Channel Leave Error:', error);
    console.error('Error details:', error.message, error.stack);
  }
}

// Handle user joining a temporary voice channel
async function handleTempChannelJoin(guild, member, channel, voiceManager) {
  try {
    const guildService = getService('guild');
    // Check if this is a temporary channel
    const tempChannel = voiceManager.tempChannels.find(ch => ch.channelId === channel.id);
    if (!tempChannel) return;

    // Check if user was invited and mark as joined
    if (voiceManager.inviteCooldowns && Array.isArray(voiceManager.inviteCooldowns)) {
      const inviteCooldowns = voiceManager.inviteCooldowns.filter(cd => 
        cd.invitedUserId === member.id && 
        cd.channelId === channel.id && 
        !cd.hasJoined
      );

      for (const cooldown of inviteCooldowns) {
        await guildService.markInviteAsJoined(guild.id, cooldown.userId, member.id);
      }
    }

  } catch (error) {
    console.error('Temp Channel Join Error:', error);
  }
}

// Log voice state changes
async function logVoiceStateChange(oldState, newState) {
  try {
    const member = newState.member;
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // Determine the action
    let action = null;
    if (!oldChannel && newChannel) {
      action = 'join';
    } else if (oldChannel && !newChannel) {
      action = 'leave';
    } else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      action = 'move';
    }

    // Skip if no meaningful action (e.g., mute/unmute, deafen/undeafen)
    if (!action) return;

    const embed = webhookLogger.createVoiceStateLog({
      action,
      member,
      oldChannel,
      newChannel
    });

    await webhookLogger.sendLog(newState.guild.id, 'events', embed);
  } catch (error) {
    // Silent fail for voice state logging
  }
}
