// Unified guild member update handler
// Handles: boost detection, nickname tracking, forced nickname enforcement

const { ensureGuildData, ensureUserData } = require('../../database');
const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');
const { getService } = require('@services');
const webhookLogger = require('../../utils/webhookLogger');
const { AuditLogEvent } = require('discord.js');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    try {
      // Log role changes
      await logRoleChanges(oldMember, newMember);

      // Handle boost events (both new boosts and boost removals)
      await handleBoostEvents(oldMember, newMember);

      // Handle nickname changes and forced nickname enforcement
      await handleNicknameChanges(oldMember, newMember);

    } catch (error) {
      // Silent fail for member update events
    }
  }
};

// Handle boost events
async function handleBoostEvents(oldMember, newMember) {
  try {
    // Check if this is a boost event (premium since timestamp changed)
    const wasBooster = oldMember.premiumSince !== null;
    const isBooster = newMember.premiumSince !== null;

    if (!wasBooster && isBooster) {
      // NEW BOOST
      await handleNewBoost(newMember);
      // Track boost addition using service layer
      const guildService = getService('guild');
      await guildService.trackBoostEvent(newMember.guild.id, newMember.user.id, 'add');
    } else if (wasBooster && !isBooster) {
      // BOOST REMOVED
      await handleBoostRemoved(newMember);
      // Track boost removal using service layer
      const guildService = getService('guild');
      await guildService.trackBoostEvent(newMember.guild.id, newMember.user.id, 'remove');
    }
  } catch (error) {
    // Silent error handling
  }
}

// Handle new boost
async function handleNewBoost(member) {
  try {
    // Process boost messages for all configured channels
    await processBoostMessages(member);

    // Handle boost role assignment using service layer
    const guildService = getService('guild');
    const boostRoleId = await guildService.getBoostRole(member.guild.id);
    if (boostRoleId) {
      const boostRole = member.guild.roles.cache.get(boostRoleId);
      if (boostRole && !member.roles.cache.has(boostRoleId)) {
        try {
          await member.roles.add(boostRole, 'User boosted the server');
        } catch (error) {
          // Silent error - role assignment failed
        }
      }
    }
  } catch (error) {
    // Silent error handling
  }
}

// Handle boost removal
async function handleBoostRemoved(member) {
  try {
    // Handle boost role removal using service layer
    const guildService = getService('guild');
    const boostRoleId = await guildService.getBoostRole(member.guild.id);
    if (boostRoleId) {
      const boostRole = member.guild.roles.cache.get(boostRoleId);
      if (boostRole && member.roles.cache.has(boostRoleId)) {
        try {
          await member.roles.remove(boostRole, 'User stopped boosting the server');
        } catch (error) {
          // Silent error - role removal failed
        }
      }
    }
  } catch (error) {
    // Silent error handling
  }
}

// Handle nickname changes and forced nickname enforcement
async function handleNicknameChanges(oldMember, newMember) {
  try {
    // Check if nickname changed
    if (oldMember.nickname !== newMember.nickname) {

      // First, handle forced nickname enforcement using service layer
      const guildService = getService('guild');
      const forcedNick = await guildService.getForceNick(newMember.guild.id, newMember.user.id);
      if (forcedNick) {
        // If the new nickname doesn't match the forced nickname, restore it
        if (newMember.nickname !== forcedNick.nickname) {
          try {
            await newMember.setNickname(forcedNick.nickname, 'Enforcing forced nickname');
            return; // Don't track this change since we're reverting it
          } catch (error) {
            // If we can't set the nickname (permissions, hierarchy, etc.), remove the forced nickname using service layer
            await guildService.removeForceNick(newMember.guild.id, newMember.user.id);
          }
        }
      }

      // Track nickname changes for history using service layer
      const oldNickname = oldMember.nickname || oldMember.user.username;
      const newNickname = newMember.nickname || newMember.user.username;

      const userService = getService('user');
      await userService.addNameChange(
        newMember.user.id,
        'nickname',
        oldNickname,
        newNickname,
        newMember.guild.id // Guild-specific change
      );
    }
  } catch (error) {
    // Silent fail for nickname handling
  }
}

async function processBoostMessages(member) {
  try {
    // Get boost messages from new multi-channel system using service layer
    const guildService = getService('guild');
    const boostMessages = await guildService.getBoostMessages(member.guild.id) || [];

    if (boostMessages.length === 0) {
      // Check for legacy boost message system
      await processLegacyBoost(member);
      return;
    }

    // Process each boost message
    for (const boostConfig of boostMessages) {
      try {
        // Get the boost channel
        const boostChannel = member.guild.channels.cache.get(boostConfig.channelId);
        if (!boostChannel) {
          // Channel no longer exists, remove from config using service layer
          await guildService.removeBoostMessage(member.guild.id, boostConfig.channelId);
          continue;
        }

        // Check if bot has permission to send messages
        if (!boostChannel.permissionsFor(member.guild.members.me)?.has(['SendMessages', 'EmbedLinks'])) {
          continue;
        }

        // Process and send the boost message with variables
        try {
          EmbedVariableProcessor.process(boostChannel, boostConfig.message, {
            user: member.user,
            guild: member.guild,
            channel: boostChannel
          });
        } catch (error) {
          // Fallback to simple text message
          boostChannel.send(`Thank you ${member} for boosting the server! 🚀`);
        }
      } catch (error) {
        // Silent fail for individual boost message
      }
    }
  } catch (error) {
    // Silent fail for boost system
  }
}

async function processLegacyBoost(member) {
  try {
    // Check for old single-channel boost system using service layer
    const guildService = getService('guild');
    const boostChannel = await guildService.getBoostChannel(member.guild.id);
    const boostMessage = await guildService.getBoostMessage(member.guild.id);

    if (!boostChannel || !boostMessage) {
      return; // No legacy boost configured
    }

    // Get the boost channel
    const channel = member.guild.channels.cache.get(boostChannel);
    if (!channel) {
      // Channel no longer exists, clean up legacy data using service layer
      await guildService.removeBoost(member.guild.id);
      return;
    }

    // Check if bot has permission to send messages
    if (!channel.permissionsFor(member.guild.members.me)?.has(['SendMessages', 'EmbedLinks'])) {
      return;
    }

    // Migrate to new system using service layer
    await guildService.addBoostMessage(member.guild.id, boostChannel, boostMessage);

    // Clean up legacy data using service layer
    await guildService.removeBoost(member.guild.id);

    // Process and send the boost message with variables
    try {
      EmbedVariableProcessor.process(channel, boostMessage, {
        user: member.user,
        guild: member.guild,
        channel: channel
      });
    } catch (error) {
      // Fallback to simple text message
      channel.send(`Thank you ${member} for boosting the server! 🚀`);
    }
  } catch (error) {
    // Silent fail for legacy boost system
  }
}

// Log role changes
async function logRoleChanges(oldMember, newMember) {
  try {
    // Get role differences
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    // Skip if no role changes
    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    // Get executor from audit logs
    let executor = null;
    try {
      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 1
      });

      const auditEntry = auditLogs.entries.first();
      if (auditEntry && 
          auditEntry.target?.id === newMember.id &&
          Date.now() - auditEntry.createdTimestamp < 5000) {
        executor = auditEntry.executor;
      }
    } catch (auditError) {
      // Silent fail if can't access audit logs
    }

    // Log each added role
    for (const [roleId, role] of addedRoles) {
      const embed = webhookLogger.createMemberRolesLog({
        action: 'add',
        member: newMember,
        role: role,
        executor: executor
      });

      await webhookLogger.sendLog(newMember.guild.id, 'events', embed);
    }

    // Log each removed role
    for (const [roleId, role] of removedRoles) {
      const embed = webhookLogger.createMemberRolesLog({
        action: 'remove',
        member: newMember,
        role: role,
        executor: executor
      });

      await webhookLogger.sendLog(newMember.guild.id, 'events', embed);
    }
  } catch (error) {
    // Silent fail for role change logging
  }
}
