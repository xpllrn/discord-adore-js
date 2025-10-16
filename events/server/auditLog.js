const { AuditLogEvent } = require('discord.js');
const webhookLogger = require('../../utils/webhookLogger');

module.exports = {
  name: 'guildAuditLogEntryCreate',
  async execute(auditLogEntry, guild, client) {
    try {
      // Skip if the action was performed by the bot itself
      if (auditLogEntry.executor?.id === client.user.id) {
        return;
      }

      // Handle different audit log events
      switch (auditLogEntry.action) {
        case AuditLogEvent.MemberBanAdd:
          await logManualBan(auditLogEntry, guild);
          break;
        
        case AuditLogEvent.MemberBanRemove:
          await logManualUnban(auditLogEntry, guild);
          break;
        
        case AuditLogEvent.MemberKick:
          await logManualKick(auditLogEntry, guild);
          break;
        
        case AuditLogEvent.MemberUpdate:
          // Check if it's a timeout action
          if (auditLogEntry.changes?.some(change => change.key === 'communication_disabled_until')) {
            await logManualTimeout(auditLogEntry, guild);
          }
          break;

        case AuditLogEvent.MemberRoleUpdate:
          await logMemberRoleUpdate(auditLogEntry, guild);
          break;

        case AuditLogEvent.ChannelOverwriteCreate:
        case AuditLogEvent.ChannelOverwriteUpdate:
        case AuditLogEvent.ChannelOverwriteDelete:
          await logChannelPermissionUpdate(auditLogEntry, guild);
          break;

        case AuditLogEvent.InviteCreate:
        case AuditLogEvent.InviteDelete:
        case AuditLogEvent.InviteUpdate:
          await logInviteUpdate(auditLogEntry, guild);
          break;

        case AuditLogEvent.WebhookCreate:
        case AuditLogEvent.WebhookDelete:
        case AuditLogEvent.WebhookUpdate:
          await logWebhookUpdate(auditLogEntry, guild);
          break;

        case AuditLogEvent.EmojiCreate:
        case AuditLogEvent.EmojiDelete:
        case AuditLogEvent.EmojiUpdate:
          await logEmojiUpdate(auditLogEntry, guild);
          break;

        case AuditLogEvent.MessageDelete:
        case AuditLogEvent.MessageBulkDelete:
          await logManualMessageDelete(auditLogEntry, guild);
          break;

        default:
          // Ignore other audit log events
          break;
      }
    } catch (error) {
      // Send error to webhook instead of console
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Audit Log Processing', {
          command: 'Audit Log Event',
          args: `Action: ${auditLogEntry.action}`,
          user: auditLogEntry.executor,
          guild: guild
        });
      }
    }
  }
};

async function logManualBan(auditLogEntry, guild) {
  try {
    const embed = webhookLogger.createModeratorLog({
      action: 'ban',
      executor: auditLogEntry.executor,
      target: auditLogEntry.target,
      reason: auditLogEntry.reason || 'No reason provided',
      guild: guild
    });

    await webhookLogger.sendLog(guild.id, 'moderator', embed);
  } catch (error) {
    // Silent fail to avoid infinite loops
  }
}

async function logManualUnban(auditLogEntry, guild) {
  try {
    const embed = webhookLogger.createModeratorLog({
      action: 'unban',
      executor: auditLogEntry.executor,
      target: auditLogEntry.target,
      reason: auditLogEntry.reason || 'No reason provided',
      guild: guild
    });

    await webhookLogger.sendLog(guild.id, 'moderator', embed);
  } catch (error) {
    // Silent fail to avoid infinite loops
  }
}

async function logManualKick(auditLogEntry, guild) {
  try {
    const embed = webhookLogger.createModeratorLog({
      action: 'kick',
      executor: auditLogEntry.executor,
      target: auditLogEntry.target,
      reason: auditLogEntry.reason || 'No reason provided',
      guild: guild
    });

    await webhookLogger.sendLog(guild.id, 'moderator', embed);
  } catch (error) {
    // Silent fail to avoid infinite loops
  }
}

async function logManualTimeout(auditLogEntry, guild) {
  try {
    // Check if timeout was added or removed
    const timeoutChange = auditLogEntry.changes.find(change => change.key === 'communication_disabled_until');

    if (!timeoutChange) return;

    const isTimeout = timeoutChange.new !== null;
    const action = isTimeout ? 'timeout' : 'untimeout';

    let duration = null;
    if (isTimeout && timeoutChange.new) {
      const timeoutEnd = new Date(timeoutChange.new);
      const now = new Date();
      const durationMs = timeoutEnd.getTime() - now.getTime();

      if (durationMs > 0) {
        const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
          duration = `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
          duration = `${hours}h ${minutes}m`;
        } else {
          duration = `${minutes}m`;
        }
      }
    }

    const embed = webhookLogger.createModeratorLog({
      action: action,
      executor: auditLogEntry.executor,
      target: auditLogEntry.target,
      reason: auditLogEntry.reason || 'No reason provided',
      duration: duration,
      guild: guild
    });

    await webhookLogger.sendLog(guild.id, 'moderator', embed);
  } catch (error) {
    // Silent fail to avoid infinite loops
  }
}

async function logMemberRoleUpdate(auditLogEntry, guild) {
  try {
    // Get the role changes
    const roleChanges = auditLogEntry.changes?.filter(change => change.key === '$add' || change.key === '$remove');

    if (!roleChanges || roleChanges.length === 0) return;

    for (const change of roleChanges) {
      const action = change.key === '$add' ? 'add' : 'remove';
      const roles = change.new || change.old;

      if (!roles || !Array.isArray(roles)) continue;

      for (const roleData of roles) {
        const role = guild.roles.cache.get(roleData.id);
        if (!role) continue;

        const embed = webhookLogger.createMemberRolesLog({
          action: action,
          member: { user: auditLogEntry.target },
          role: role,
          executor: auditLogEntry.executor
        });

        await webhookLogger.sendLog(guild.id, 'events', embed);
      }
    }
  } catch (error) {
    // Silent fail to avoid infinite loops
  }
}

async function logChannelPermissionUpdate(auditLogEntry, guild) {
  try {
    const channel = guild.channels.cache.get(auditLogEntry.targetId);
    if (!channel) return;

    let action = 'update';
    if (auditLogEntry.action === 13) action = 'create'; // ChannelOverwriteCreate
    if (auditLogEntry.action === 15) action = 'delete'; // ChannelOverwriteDelete

    // Get the target (role or member)
    let target = null;
    if (auditLogEntry.extra?.type === 'role') {
      target = guild.roles.cache.get(auditLogEntry.extra.id);
    } else if (auditLogEntry.extra?.type === 'member') {
      target = guild.members.cache.get(auditLogEntry.extra.id);
    }

    const embed = webhookLogger.createChannelPermissionsLog({
      action: action,
      channel: channel,
      target: target,
      executor: auditLogEntry.executor,
      changes: auditLogEntry.changes
    });

    await webhookLogger.sendLog(guild.id, 'events', embed);
  } catch (error) {
    // Silent fail to avoid infinite loops
  }
}

async function logInviteUpdate(auditLogEntry, guild) {
  try {
    let actionName = 'Invite Updated';
    if (auditLogEntry.action === 40) actionName = 'Invite Created'; // InviteCreate
    if (auditLogEntry.action === 42) actionName = 'Invite Deleted'; // InviteDelete

    const embed = webhookLogger.createServerEventLog({
      action: auditLogEntry.action === 40 ? 'inviteCreate' :
              auditLogEntry.action === 42 ? 'inviteDelete' : 'inviteUpdate',
      executor: auditLogEntry.executor,
      target: auditLogEntry.target,
      changes: auditLogEntry.changes,
      guild: guild
    });

    await webhookLogger.sendLog(guild.id, 'events', embed);
  } catch (error) {
    // Silent fail to avoid infinite loops
  }
}

async function logWebhookUpdate(auditLogEntry, guild) {
  try {
    let actionName = 'Webhook Updated';
    if (auditLogEntry.action === 50) actionName = 'Webhook Created'; // WebhookCreate
    if (auditLogEntry.action === 52) actionName = 'Webhook Deleted'; // WebhookDelete

    const embed = webhookLogger.createServerEventLog({
      action: auditLogEntry.action === 50 ? 'webhookCreate' :
              auditLogEntry.action === 52 ? 'webhookDelete' : 'webhookUpdate',
      executor: auditLogEntry.executor,
      target: auditLogEntry.target,
      changes: auditLogEntry.changes,
      guild: guild
    });

    await webhookLogger.sendLog(guild.id, 'events', embed);
  } catch (error) {
    // Silent fail to avoid infinite loops
  }
}

async function logEmojiUpdate(auditLogEntry, guild) {
  try {
    let actionName = 'Emoji Updated';
    if (auditLogEntry.action === 60) actionName = 'Emoji Created'; // EmojiCreate
    if (auditLogEntry.action === 62) actionName = 'Emoji Deleted'; // EmojiDelete

    const embed = webhookLogger.createServerEventLog({
      action: auditLogEntry.action === 60 ? 'emojiCreate' :
              auditLogEntry.action === 62 ? 'emojiDelete' : 'emojiUpdate',
      executor: auditLogEntry.executor,
      target: auditLogEntry.target,
      changes: auditLogEntry.changes,
      guild: guild
    });

    await webhookLogger.sendLog(guild.id, 'events', embed);
  } catch (error) {
    // Silent fail to avoid infinite loops
  }
}

async function logManualMessageDelete(auditLogEntry, guild) {
  try {
    // Only log if it's a manual deletion (not by the message author)
    if (auditLogEntry.executor?.id === auditLogEntry.target?.id) return;

    let actionName = 'Message Deleted';
    if (auditLogEntry.action === 73) actionName = 'Messages Bulk Deleted'; // MessageBulkDelete

    const embed = webhookLogger.createServerEventLog({
      action: auditLogEntry.action === 73 ? 'messageBulkDelete' : 'messageDelete',
      executor: auditLogEntry.executor,
      target: auditLogEntry.target,
      changes: auditLogEntry.changes,
      guild: guild
    });

    await webhookLogger.sendLog(guild.id, 'moderator', embed);
  } catch (error) {
    // Silent fail to avoid infinite loops
  }
}
