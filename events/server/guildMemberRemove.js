const webhookLogger = require('../../utils/webhookLogger');
const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { getService } = require('@services');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      if (!member.guild) return;

      // Get audit log info to check if it was a kick
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

      // Antinuke check for kicks
      if (wasKicked && executor && !executor.bot) {
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

      const embed = webhookLogger.createServerEventLog({
        action: wasKicked ? 'memberKick' : 'memberLeave',
        executor: executor,
        target: member.user,
        guild: member.guild
      });

      await webhookLogger.sendLog(member.guild.id, 'events', embed);
    } catch (error) {
      // Silent fail
    }
  }
};
