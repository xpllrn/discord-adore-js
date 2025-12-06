const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getService } = require('@services');
const webhookLogger = require('../../utils/webhookLogger');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    try {
      // Skip if no guild or member
      if (!newState.guild || !newState.member) return;

      // Skip bots for voice manager functionality
      if (newState.member.user.bot) return;

      // Log voice state changes (after bot check)
      await logVoiceStateChange(oldState, newState);

      const guild = newState.guild;
      const member = newState.member;
      const guildService = getService('guild');

      // Handle voice leveling system (before voice manager)
      await handleVoiceLeveling(oldState, newState, guild, member, guildService);

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

    // Add to database
    await guildService.addTempVoiceChannel(guild.id, tempChannel.id, member.id);

    // Move user to their new channel
    await member.voice.setChannel(tempChannel);

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

    // Check if channel is now empty
    if (channel.members.size === 0) {
      // Delete the channel
      await channel.delete('Temporary voice channel auto-cleanup');
      
      // Remove from database
      await guildService.removeTempVoiceChannel(guild.id, channel.id);
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

// Handle voice leveling system
async function handleVoiceLeveling(oldState, newState, guild, member, guildService) {
  try {
    // Check if level system is enabled
    const isEnabled = await guildService.isLevelSystemEnabled(guild.id);
    if (!isEnabled) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    const userId = member.id;

    // User joined a voice channel
    if (!oldChannel && newChannel) {
      // Check if user is not self-muted/deafened or AFK
      if (!newState.selfMute && !newState.selfDeaf && !newState.serverMute && !newState.serverDeaf) {
        // Set join time
        await guildService.setVoiceJoinTime(guild.id, userId, new Date());
      }
    }
    // User left a voice channel
    else if (oldChannel && !newChannel) {
      // Get join time
      const joinTime = await guildService.getVoiceJoinTime(guild.id, userId);
      if (joinTime) {
        // Calculate time spent
        const now = new Date();
        const minutesSpent = Math.floor((now - joinTime) / 60000);

        if (minutesSpent > 0) {
          // Track voice time
          await guildService.trackVoiceTime(guild.id, userId, minutesSpent);
        }

        // Clear join time
        await guildService.clearVoiceJoinTime(guild.id, userId);
      }
    }
    // User moved channels or changed state
    else if (oldChannel && newChannel) {
      const wasActive = !oldState.selfMute && !oldState.selfDeaf && !oldState.serverMute && !oldState.serverDeaf;
      const isActive = !newState.selfMute && !newState.selfDeaf && !newState.serverMute && !newState.serverDeaf;

      // User became inactive (muted/deafened)
      if (wasActive && !isActive) {
        const joinTime = await guildService.getVoiceJoinTime(guild.id, userId);
        if (joinTime) {
          const now = new Date();
          const minutesSpent = Math.floor((now - joinTime) / 60000);

          if (minutesSpent > 0) {
            await guildService.trackVoiceTime(guild.id, userId, minutesSpent);
          }

          await guildService.clearVoiceJoinTime(guild.id, userId);
        }
      }
      // User became active (unmuted/undeafened)
      else if (!wasActive && isActive) {
        await guildService.setVoiceJoinTime(guild.id, userId, new Date());
      }
    }

    // Award XP if user is currently in voice and active
    if (newChannel && !newState.selfMute && !newState.selfDeaf && !newState.serverMute && !newState.serverDeaf) {
      await awardVoiceXP(guild, member, guildService);
    }

  } catch (error) {
    console.error('Voice Leveling Error:', error);
  }
}

// Award voice XP (called periodically)
async function awardVoiceXP(guild, member, guildService) {
  try {
    const userId = member.id;
    const lastXPTime = await guildService.getLastVoiceXPTime(guild.id, userId);
    const now = new Date();

    // Check if at least 1 minute has passed since last XP award
    if (lastXPTime) {
      const timeDiff = now - lastXPTime;
      const minutesPassed = Math.floor(timeDiff / 60000);

      if (minutesPassed < 1) return; // Not enough time passed
    }

    // Award 10-15 XP per minute
    const xpGain = Math.floor(Math.random() * 6) + 10;

    // Add XP and check for level up
    const result = await guildService.addUserExperience(guild.id, userId, xpGain);

    // Update last XP time
    await guildService.updateLastVoiceXPTime(guild.id, userId, now);

    // If user leveled up, send level up message
    if (result.leveledUp) {
      await handleVoiceLevelUp(guild, member, result.newLevel);
    }

  } catch (error) {
    // Silent fail for voice XP
  }
}

// Handle voice level up notifications
async function handleVoiceLevelUp(guild, member, newLevel) {
  try {
    const { getService } = require('@services');
    const guildService = getService('guild');
    const { EmbedBuilder } = require('discord.js');
    const { colors } = require('../../config/setup');
    const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');

    // Get message mode
    const messageMode = await guildService.getLevelMessageMode(guild.id);

    if (messageMode === 'none') return;

    // Determine where to send the message
    let targetChannel = null;

    if (messageMode === 'channel') {
      const levelUpChannelId = await guildService.getLevelUpChannel(guild.id);
      if (levelUpChannelId) {
        targetChannel = guild.channels.cache.get(levelUpChannelId);
      }
    }

    // If no target channel found, skip (voice leveling doesn't have context channel)
    if (!targetChannel) return;

    // Check for custom level message
    const customLevelMessage = await guildService.getLevelCustomMessage(guild.id);
    const levelSystem = await guildService.getLevelSystem(guild.id);

    if (customLevelMessage) {
      // Use custom level message with variable processing
      EmbedVariableProcessor.process(targetChannel, customLevelMessage, {
        user: member.user,
        guild: guild,
        channel: targetChannel,
        pingEnabled: levelSystem?.customMessagePingEnabled || false,
        level: { new_rank: newLevel }
      });
    } else {
      // Use default level up embed
      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setAuthor({
          name: member.user.username,
          iconURL: member.user.displayAvatarURL({ dynamic: true })
        })
        .setDescription(`**${member.displayName}** had **leveled up** from voice!\n> They are now **level ${newLevel}**, yayyyyy`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

      await targetChannel.send({ 
        content: member.user.toString(),
        embeds: [embed] 
      });
    }

    // Check and assign level roles
    await assignVoiceLevelRoles(guild, member, newLevel, guildService);

  } catch (error) {
    // Silent fail for level up message
  }
}

// Assign level roles when user levels up from voice
async function assignVoiceLevelRoles(guild, member, newLevel, guildService) {
  try {
    // Get level roles
    const levelRoles = await guildService.getLevelRoles(guild.id);
    if (!levelRoles || levelRoles.length === 0) return;

    // Check if roles should stack
    const stackRoles = await guildService.getStackRoles(guild.id);

    if (stackRoles) {
      // Stack mode: Add all eligible roles
      const eligibleRoles = levelRoles.filter(lr => lr.level <= newLevel);

      for (const levelRole of eligibleRoles) {
        const role = guild.roles.cache.get(levelRole.roleId);
        if (role && !member.roles.cache.has(role.id)) {
          try {
            await member.roles.add(role);
          } catch (error) {
            // Silent fail
          }
        }
      }
    } else {
      // No stack mode: Only keep the highest level role
      const eligibleRoles = levelRoles.filter(lr => lr.level <= newLevel);
      
      if (eligibleRoles.length === 0) return;

      const sortedRoles = eligibleRoles.sort((a, b) => b.level - a.level);
      const highestLevelRole = sortedRoles[0];
      const highestRole = guild.roles.cache.get(highestLevelRole.roleId);

      if (!highestRole) return;

      // Remove all other level roles
      for (const levelRole of levelRoles) {
        if (levelRole.roleId !== highestLevelRole.roleId) {
          const role = guild.roles.cache.get(levelRole.roleId);
          if (role && member.roles.cache.has(role.id)) {
            try {
              await member.roles.remove(role);
            } catch (error) {
              // Silent fail
            }
          }
        }
      }

      // Add the highest level role
      if (!member.roles.cache.has(highestRole.id)) {
        try {
          await member.roles.add(highestRole);
        } catch (error) {
          // Silent fail
        }
      }
    }

  } catch (error) {
    // Silent fail for role assignment
  }
}
