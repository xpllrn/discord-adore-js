const webhookLogger = require('../../utils/webhookLogger');
const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { getService } = require('@services');

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

      // Antinuke check
      if (executor && !executor.bot) {
        try {
          const antinukeService = getService('antinuke');
          const check = await antinukeService.checkAction(channel.guild.id, executor.id, 'channel', channel.guild);
          
          if (check.blocked) {
            const settings = await antinukeService.getSettings(channel.guild.id);
            const punishment = settings.modules.channel.punishment || 'strip';

            // Delete the malicious channel
            await channel.delete('Antinuke: Mass channel creation detected').catch(() => {});

            // Apply punishment to violator
            await antinukeService.applyPunishment(
              channel.guild,
              executor.id,
              punishment,
              'Antinuke: Mass channel creation detected',
              [PermissionFlagsBits.ManageChannels]
            );

            await antinukeService.logAction(
              channel.guild.id,
              'channel_create_blocked',
              executor.id,
              `Blocked mass channel creation - ${check.reason} - Punishment: ${punishment}`
            );
          }
        } catch (antinukeError) {
          // Silent fail for antinuke
        }
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
