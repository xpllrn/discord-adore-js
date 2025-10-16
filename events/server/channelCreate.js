const webhookLogger = require('../../utils/webhookLogger');
const { AuditLogEvent } = require('discord.js');

module.exports = {
  name: 'channelCreate',
  async execute(channel) {
    try {
      if (!channel.guild) return;

      // Get audit log info
      let executor = null;
      try {
        const auditLogs = await channel.guild.fetchAuditLogs({
          type: AuditLogEvent.ChannelCreate,
          limit: 1
        });

        const auditEntry = auditLogs.entries.first();
        if (auditEntry && 
            auditEntry.target?.id === channel.id &&
            Date.now() - auditEntry.createdTimestamp < 5000) {
          executor = auditEntry.executor;
        }
      } catch (auditError) {
        // Silent fail if can't access audit logs
      }

      const embed = webhookLogger.createServerEventLog({
        action: 'channelCreate',
        executor: executor,
        target: channel,
        guild: channel.guild
      });

      await webhookLogger.sendLog(channel.guild.id, 'events', embed);
    } catch (error) {
      // Send error to webhook instead of console
      if (channel.client?.errorLogger) {
        channel.client.errorLogger.log(error, 'Channel Create Logging', {
          command: 'Channel Create Event',
          args: `Channel: ${channel.name || 'Unknown'}`,
          guild: channel.guild
        });
      }
    }
  }
};
