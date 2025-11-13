const webhookLogger = require('../../utils/webhookLogger');
const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { getService } = require('@services');
const { ensureGuildData } = require('../../database');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      if (!member.guild) return;

      // Save member roles for restore feature (2 hour expiry)
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
        console.error('Error saving roles for restore:', saveError);
      }

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
