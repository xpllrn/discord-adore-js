const { ChannelType, PermissionFlagsBits } = require('discord.js');
const guildCache = require('../../database/cache/models/guild');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    try {
      // Skip if no guild
      if (!newState.guild) return;

      // Skip bots
      if (newState.member.user.bot) return;

      const guild = newState.guild;
      const member = newState.member;

      // Get voice manager configuration
      const voiceManager = await guildCache.getVoiceManager(guild.id);
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
        await guildCache.removeTempVoiceChannel(guild.id, existingChannel.channelId);
      }
    }

    // Get the voice category
    const category = guild.channels.cache.get(voiceManager.categoryId);
    if (!category) {
      console.error('Voice Manager: Category not found');
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
        }
      ]
    });

    // Add to database
    await guildCache.addTempVoiceChannel(guild.id, tempChannel.id, member.id);

    // Move user to their new channel
    await member.voice.setChannel(tempChannel);

  } catch (error) {
    console.error('Join to Create Error:', error);
  }
}

// Handle user leaving a temporary voice channel
async function handleTempChannelLeave(guild, channel, voiceManager) {
  try {
    // Check if this is a temporary channel
    const tempChannel = voiceManager.tempChannels.find(ch => ch.channelId === channel.id);
    if (!tempChannel) return;

    // Check if channel is now empty
    if (channel.members.size === 0) {
      // Delete the channel
      await channel.delete('Temporary voice channel auto-cleanup');
      
      // Remove from database
      await guildCache.removeTempVoiceChannel(guild.id, channel.id);
    }

  } catch (error) {
    console.error('Temp Channel Leave Error:', error);
  }
}

// Handle user joining a temporary voice channel
async function handleTempChannelJoin(guild, member, channel, voiceManager) {
  try {
    // Check if this is a temporary channel
    const tempChannel = voiceManager.tempChannels.find(ch => ch.channelId === channel.id);
    if (!tempChannel) return;

    // Check if user was invited and mark as joined
    const inviteCooldowns = voiceManager.inviteCooldowns.filter(cd => 
      cd.invitedUserId === member.id && 
      cd.channelId === channel.id && 
      !cd.hasJoined
    );

    for (const cooldown of inviteCooldowns) {
      await guildCache.markInviteAsJoined(guild.id, cooldown.userId, member.id);
    }

  } catch (error) {
    console.error('Temp Channel Join Error:', error);
  }
}
