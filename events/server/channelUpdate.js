const webhookLogger = require('../../utils/webhookLogger');
const { AuditLogEvent } = require('discord.js');

module.exports = {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel) {
    try {
      if (!newChannel.guild) return;

      // Get audit log info
      let executor = null;
      let changes = [];

      try {
        const auditLogs = await newChannel.guild.fetchAuditLogs({
          type: AuditLogEvent.ChannelUpdate,
          limit: 5
        });

        // Find the most recent audit entry for this channel
        const auditEntry = auditLogs.entries.find(entry => 
          entry.target?.id === newChannel.id &&
          Date.now() - entry.createdTimestamp < 10000
        );

        if (auditEntry) {
          executor = auditEntry.executor;
          
          // Extract changes from audit log
          if (auditEntry.changes) {
            changes = auditEntry.changes.map(change => ({
              key: change.key,
              old: change.old,
              new: change.new
            }));
          }
        }
      } catch (auditError) {
        // Silent fail if can't access audit logs
      }

      // If no audit log changes, detect basic changes
      if (changes.length === 0) {
        if (oldChannel.name !== newChannel.name) {
          changes.push({
            key: 'name',
            old: oldChannel.name,
            new: newChannel.name
          });
        }
        if (oldChannel.topic !== newChannel.topic) {
          changes.push({
            key: 'topic',
            old: oldChannel.topic || 'None',
            new: newChannel.topic || 'None'
          });
        }
      }

      // Skip if no meaningful changes
      if (changes.length === 0) return;

      const embed = webhookLogger.createServerEventLog({
        action: 'channelUpdate',
        executor: executor,
        target: newChannel,
        changes: changes,
        guild: newChannel.guild
      });

      await webhookLogger.sendLog(newChannel.guild.id, 'events', embed);
    } catch (error) {
      // Send error to webhook instead of console
      if (newChannel.client?.errorLogger) {
        newChannel.client.errorLogger.log(error, 'Channel Update Logging', {
          command: 'Channel Update Event',
          args: `Channel: ${newChannel.name || 'Unknown'}`,
          guild: newChannel.guild
        });
      }
    }
  }
};
