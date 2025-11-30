const webhookLogger = require('../../utils/webhookLogger');
const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { getService } = require('@services');
const { ensureGuildData } = require('../../database');
const { EmbedVariableProcessor } = require('../../utils/embeds/embedbuilder');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      if (!member.guild) return;

      // Save member roles for restore feature (2 hour expiry)
      await saveRolesForRestore(member);

      // Get audit log info to check if it was a kick
      const { executor, wasKicked } = await checkIfKicked(member);

      // Antinuke check for kicks
      if (wasKicked && executor && !executor.bot) {
        await handleAntinukeCheck(member, executor);
      }

      // Log the member leave/kick event
      await logMemberLeaveOrKick(member, executor, wasKicked);

      // Process leave messages for all configured channels
      await processLeaveMessages(member);

    } catch (error) {
      // Silent fail
    }
  }
};

async function saveRolesForRestore(member) {
  try {
    const guildData = await ensureGuildData(member.guild.id);
    
    // Get all roles except @everyone and boost role
    const rolesToSave = member.roles.cache
      .filter(role => 
        role.id !== member.guild.id && // Not @everyone
        role.id !== member.guild.premiumSubscriberRole?.id // Not boost role
      )
      .map(role => role.id);

    if (rolesToSave.length > 0) {
      // Remove any existing restore data for this user
      guildData.RoleRestore = guildData.RoleRestore.filter(
        restore => restore.userId !== member.id
      );

      // Add new restore data
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
      guildData.RoleRestore.push({
        userId: member.id,
        roles: rolesToSave,
        leftAt: new Date(),
        expiresAt: expiresAt
      });

      // Clean up expired restore data
      guildData.RoleRestore = guildData.RoleRestore.filter(
        restore => restore.expiresAt > new Date()
      );

      await guildData.save();
    }
  } catch (saveError) {
    // Silent fail for role restore
  }
}

async function checkIfKicked(member) {
  let executor = null;
  let wasKicked = false;

  try {
    const auditLogs = await member.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberKick,
      limit: 1
    });

    const auditEntry = auditLogs.entries.first();
    if (auditEntry && 
        auditEntry.target?.id === member.id &&
        Date.now() - auditEntry.createdTimestamp < 5000) {
      executor = auditEntry.executor;
      wasKicked = true;
    }
  } catch (auditError) {
    // Silent fail if can't access audit logs
  }

  return { executor, wasKicked };
}

async function handleAntinukeCheck(member, executor) {
  try {
    const antinukeService = getService('antinuke');
    const check = await antinukeService.checkAction(member.guild.id, executor.id, 'kick');
    
    if (check.blocked) {
      const settings = await antinukeService.getSettings(member.guild.id);
      const punishment = settings.modules.kick.punishment || 'strip';

      await antinukeService.applyPunishment(
        member.guild,
        executor.id,
        punishment,
        'Antinuke: Mass kick detected',
        [PermissionFlagsBits.KickMembers]
      );

      await antinukeService.logAction(
        member.guild.id,
        'kick_blocked',
        executor.id,
        `Blocked mass kick - ${check.reason} - Punishment: ${punishment}`
      );
    }
  } catch (antinukeError) {
    // Silent fail for antinuke
  }
}

async function logMemberLeaveOrKick(member, executor, wasKicked) {
  try {
    if (wasKicked) {
      // For kicks, use the server event log
      const embed = webhookLogger.createServerEventLog({
        action: 'memberKick',
        executor: executor,
        target: member.user,
        guild: member.guild
      });
      await webhookLogger.sendLog(member.guild.id, 'events', embed);
    } else {
      // For leaves, use the member log (same as join)
      const embed = webhookLogger.createMemberLog({
        action: 'memberLeave',
        member: member,
        guild: member.guild
      });
      await webhookLogger.sendLog(member.guild.id, 'members', embed);
    }
  } catch (error) {
    // Silent fail for logging
  }
}

async function processLeaveMessages(member) {
  try {
    const guildService = getService('guild');
    
    // Get leave messages from multi-channel system
    const leaveMessages = await guildService.getLeaveMessages(member.guild.id) || [];

    if (leaveMessages.length === 0) {
      return; // No leave messages configured
    }

    // Process each leave message
    for (const leaveConfig of leaveMessages) {
      try {
        // Get the leave channel
        const leaveChannel = member.guild.channels.cache.get(leaveConfig.channelId);
        if (!leaveChannel) {
          // Channel no longer exists, remove from config
          await guildService.removeLeaveMessage(member.guild.id, leaveConfig.channelId);
          continue;
        }

        // Check if bot has permission to send messages
        if (!leaveChannel.permissionsFor(member.guild.members.me)?.has(['SendMessages', 'EmbedLinks'])) {
          continue;
        }

        // Process and send the leave message with variables
        try {
          EmbedVariableProcessor.process(leaveChannel, leaveConfig.message, {
            user: member.user,
            guild: member.guild,
            channel: leaveChannel
          });
        } catch (error) {
          // Fallback to simple text message
          leaveChannel.send(`Goodbye ${member.user.username}!`);
        }
      } catch (error) {
        // Silent fail for individual leave message
      }
    }
  } catch (error) {
    // Silent fail for leave system
  }
}
