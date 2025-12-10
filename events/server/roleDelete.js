const webhookLogger = require('../../utils/webhookLogger');
const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { getService } = require('@services');

module.exports = {
  name: 'roleDelete',
  async execute(role) {
    try {
      if (!role.guild) return;

      // Get audit log info
      let executor = null;
      try {
        const auditLogs = await role.guild.fetchAuditLogs({
          type: AuditLogEvent.RoleDelete,
          limit: 1
        });

        const auditEntry = auditLogs.entries.first();
        if (auditEntry && 
            auditEntry.target?.id === role.id &&
            Date.now() - auditEntry.createdTimestamp < 5000) {
          executor = auditEntry.executor;
        }
      } catch (auditError) {
        // Silent fail if can't access audit logs
      }

      // Antinuke check
      if (executor && !executor.bot) {
        try {
          const antinukeService = getService('antinuke');
          const check = await antinukeService.checkAction(role.guild.id, executor.id, 'role', role.guild);
          
          if (check.blocked) {
            const settings = await antinukeService.getSettings(role.guild.id);
            const punishment = settings.modules.role.punishment || 'strip';

            await antinukeService.applyPunishment(
              role.guild,
              executor.id,
              punishment,
              'Antinuke: Mass role deletion detected',
              [PermissionFlagsBits.ManageRoles]
            );

            await antinukeService.logAction(
              role.guild.id,
              'role_delete_blocked',
              executor.id,
              `Blocked mass role deletion - ${check.reason} - Punishment: ${punishment}`
            );
          }
        } catch (antinukeError) {
          // Silent fail for antinuke
        }
      }

      const embed = webhookLogger.createServerEventLog({
        action: 'roleDelete',
        executor: executor,
        target: role,
        guild: role.guild
      });

      await webhookLogger.sendLog(role.guild.id, 'events', embed);
    } catch (error) {
      // Send error to webhook instead of console
      if (role.client?.errorLogger) {
        role.client.errorLogger.log(error, 'Role Delete Logging', {
          command: 'Role Delete Event',
          args: `Role: ${role.name || 'Unknown'}`,
          guild: role.guild
        });
      }
    }
  }
};
