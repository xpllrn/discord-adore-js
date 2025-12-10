const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { getService } = require('@services');

module.exports = {
  name: 'webhooksUpdate',
  async execute(channel) {
    try {
      if (!channel.guild) return;

      // Get audit log info for webhook creation
      let executor = null;
      try {
        const auditLogs = await channel.guild.fetchAuditLogs({
          type: AuditLogEvent.WebhookCreate,
          limit: 5
        });

        // Find the most recent webhook creation audit entry
        const auditEntry = auditLogs.entries.find(entry =>
          entry.targetId === channel.id &&
          Date.now() - entry.createdTimestamp < 10000
        );

        if (auditEntry) {
          executor = auditEntry.executor;
        }
      } catch (auditError) {
        // Silent fail if can't access audit logs
      }

      // Antinuke check
      if (executor && !executor.bot) {
        try {
          const antinukeService = getService('antinuke');
          const check = await antinukeService.checkAction(channel.guild.id, executor.id, 'webhook', channel.guild);
          
          if (check.blocked) {
            const settings = await antinukeService.getSettings(channel.guild.id);
            const punishment = settings.modules.webhook.punishment || 'strip';

            // Delete all webhooks in the channel
            const webhooks = await channel.fetchWebhooks().catch(() => null);
            if (webhooks) {
              for (const [, webhook] of webhooks) {
                await webhook.delete('Antinuke: Mass webhook creation detected').catch(() => {});
              }
            }

            // Apply punishment to violator
            await antinukeService.applyPunishment(
              channel.guild,
              executor.id,
              punishment,
              'Antinuke: Mass webhook creation detected',
              [PermissionFlagsBits.ManageWebhooks]
            );

            await antinukeService.logAction(
              channel.guild.id,
              'webhook_create_blocked',
              executor.id,
              `Blocked mass webhook creation - ${check.reason} - Punishment: ${punishment}`
            );
          }
        } catch (antinukeError) {
          // Silent fail for antinuke
        }
      }
    } catch (error) {
      // Silent fail
    }
  }
};
