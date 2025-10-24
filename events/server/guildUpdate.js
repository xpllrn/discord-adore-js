// Guild update handler for tracking guild name changes

module.exports = {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild) {
    try {
      // Skip if no name change
      if (oldGuild.name === newGuild.name) {
        return;
      }

      const { getService } = require('@services');
      const { ensureGuildData } = require('../../database');
      const guildService = getService('guild');

      // Ensure guild data exists
      await ensureGuildData(newGuild.id);

      // Try to get who changed the name from audit logs
      let changedBy = null;
      try {
        const auditLogs = await newGuild.fetchAuditLogs({
          type: 1, // GUILD_UPDATE
          limit: 1
        });

        const auditEntry = auditLogs.entries.first();
        if (auditEntry && 
            auditEntry.changes && 
            auditEntry.changes.some(change => change.key === 'name') &&
            Date.now() - auditEntry.createdTimestamp < 5000) { // Within 5 seconds
          changedBy = auditEntry.executor.id;
        }
      } catch (auditError) {
        // Silent fail if can't access audit logs
      }

      // Track guild name change
      await guildService.addGuildNameChange(
        newGuild.id,
        oldGuild.name,
        newGuild.name,
        changedBy
      );

    } catch (error) {
      // Silent fail for guild name tracking
      console.error('Error tracking guild name change:', error);
    }
  }
}
