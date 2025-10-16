const webhookLogger = require('../../utils/webhookLogger');
const { AuditLogEvent } = require('discord.js');

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
