// Unified guild member update handler
// Handles: boost detection, nickname tracking, forced nickname enforcement

const { ensureGuildData, ensureUserData } = require('../../database');
const { EmbedVariableProcessor } = require('../../utils/embedbuilder');
const guildCache = require('../../database/cache/models/guild');
const userCache = require('../../database/cache/models/user');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    try {
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
      // Track boost addition
      await guildCache.trackBoostEvent(newMember.guild.id, newMember.user.id, 'add');
    } else if (wasBooster && !isBooster) {
      // BOOST REMOVED
      await handleBoostRemoved(newMember);
      // Track boost removal
      await guildCache.trackBoostEvent(newMember.guild.id, newMember.user.id, 'remove');
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

    // Handle boost role assignment
    const boostRoleId = await guildCache.getBoostRole(member.guild.id);
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
    // Handle boost role removal
    const boostRoleId = await guildCache.getBoostRole(member.guild.id);
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

      // First, handle forced nickname enforcement
      const forcedNick = await guildCache.getForceNick(newMember.guild.id, newMember.user.id);
      if (forcedNick) {
        // If the new nickname doesn't match the forced nickname, restore it
        if (newMember.nickname !== forcedNick.nickname) {
          try {
            await newMember.setNickname(forcedNick.nickname, 'Enforcing forced nickname');
            return; // Don't track this change since we're reverting it
          } catch (error) {
            // If we can't set the nickname (permissions, hierarchy, etc.), remove the forced nickname
            await guildCache.removeForceNick(newMember.guild.id, newMember.user.id);
          }
        }
      }

      // Track nickname changes for history
      await ensureUserData(newMember.user.id);
      const oldNickname = oldMember.nickname || oldMember.user.username;
      const newNickname = newMember.nickname || newMember.user.username;

      await userCache.addNameChange(
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
    // Get boost messages from new multi-channel system
    const boostMessages = await guildCache.getBoostMessages(member.guild.id) || [];

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
          // Channel no longer exists, remove from config
          await guildCache.removeBoostMessage(member.guild.id, boostConfig.channelId);
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
    // Check for old single-channel boost system
    const boostChannel = await guildCache.getBoostChannel(member.guild.id);
    const boostMessage = await guildCache.getBoostMessage(member.guild.id);

    if (!boostChannel || !boostMessage) {
      return; // No legacy boost configured
    }

    // Get the boost channel
    const channel = member.guild.channels.cache.get(boostChannel);
    if (!channel) {
      // Channel no longer exists, clean up legacy data
      await guildCache.removeBoost(member.guild.id);
      return;
    }

    // Check if bot has permission to send messages
    if (!channel.permissionsFor(member.guild.members.me)?.has(['SendMessages', 'EmbedLinks'])) {
      return;
    }

    // Migrate to new system
    await guildCache.addBoostMessage(member.guild.id, boostChannel, boostMessage);

    // Clean up legacy data
    await guildCache.removeBoost(member.guild.id);

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
