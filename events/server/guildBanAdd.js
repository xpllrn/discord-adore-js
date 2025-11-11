const webhookLogger = require('../../utils/webhookLogger');
const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { getService } = require('@services');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    try {
      if (!ban.guild) return;

      // Get audit log info
      let executor = null;
      try {
        const auditLogs = await ban.guild.fetchAuditLogs({
          type: AuditLogEvent.MemberBanAdd,
          limit: 1
        });

        const auditEntry = auditLogs.entries.first();
        if (auditEntry && 
            auditEntry.target?.id === ban.user.id &&
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
          const check = await antinukeService.checkAction(ban.guild.id, executor.id, 'ban');
          
          if (check.blocked) {
            const settings = await antinukeService.getSettings(ban.guild.id);
            const punishment = settings.modules.ban.punishment || 'strip';

            // Unban the victim first
            await ban.guild.members.unban(ban.user.id, 'Antinuke: Reversed malicious ban').catch(() => {});

            // Apply punishment to violator
            await antinukeService.applyPunishment(
              ban.guild,
              executor.id,
              punishment,
              'Antinuke: Mass ban detected',
              [PermissionFlagsBits.BanMembers]
            );

            await antinukeService.logAction(
              ban.guild.id,
              'ban_blocked',
              executor.id,
              `Blocked mass ban - ${check.reason} - Punishment: ${punishment}`
            );
          }
        } catch (antinukeError) {
          // Silent fail for antinuke
        }
      }

      const embed = webhookLogger.createServerEventLog({
        action: 'guildBanAdd',
        executor: executor,
        target: ban.user,
        guild: ban.guild
      });

      await webhookLogger.sendLog(ban.guild.id, 'events', embed);
    } catch (error) {
      // Silent fail
    }
  }
};
