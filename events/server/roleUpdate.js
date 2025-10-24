const webhookLogger = require('../../utils/webhookLogger');
const { AuditLogEvent } = require('discord.js');
const { getService } = require('@services');

module.exports = {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    try {
      if (!newRole.guild) return;

      // Get audit log info
      let executor = null;
      let changes = [];

      try {
        const auditLogs = await newRole.guild.fetchAuditLogs({
          type: AuditLogEvent.RoleUpdate,
          limit: 1
        });

        const auditEntry = auditLogs.entries.first();
        if (auditEntry && 
            auditEntry.target?.id === newRole.id &&
            Date.now() - auditEntry.createdTimestamp < 5000) {
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
        if (oldRole.name !== newRole.name) {
          changes.push({
            key: 'name',
            old: oldRole.name,
            new: newRole.name
          });
        }
        if (oldRole.color !== newRole.color) {
          changes.push({
            key: 'color',
            old: oldRole.hexColor,
            new: newRole.hexColor
          });
        }
        if (oldRole.hoist !== newRole.hoist) {
          changes.push({
            key: 'hoist',
            old: oldRole.hoist ? 'Yes' : 'No',
            new: newRole.hoist ? 'Yes' : 'No'
          });
        }
        if (oldRole.mentionable !== newRole.mentionable) {
          changes.push({
            key: 'mentionable',
            old: oldRole.mentionable ? 'Yes' : 'No',
            new: newRole.mentionable ? 'Yes' : 'No'
          });
        }
      }

      // Skip if no meaningful changes
      if (changes.length === 0) return;

      const embed = webhookLogger.createServerEventLog({
        action: 'roleUpdate',
        executor: executor,
        target: newRole,
        changes: changes,
        guild: newRole.guild
      });

      await webhookLogger.sendLog(newRole.guild.id, 'events', embed);

      // Handle booster role hierarchy management
      await handleBoosterRoleHierarchy(oldRole, newRole);
    } catch (error) {
      // Send error to webhook instead of console
      if (newRole.client?.errorLogger) {
        newRole.client.errorLogger.log(error, 'Role Update Logging', {
          command: 'Role Update Event',
          args: `Role: ${newRole.name || 'Unknown'}`,
          guild: newRole.guild
        });
      }
    }
  }
};

// Handle booster role hierarchy management
async function handleBoosterRoleHierarchy(oldRole, newRole) {
  try {
    const guildService = getService('guild');
    
    // Check if booster role system is enabled
    const isEnabled = await guildService.isBoosterRoleSystemEnabled(newRole.guild.id);
    if (!isEnabled) return;

    const baseRoleId = await guildService.getBoosterRoleBaseRole(newRole.guild.id);
    if (!baseRoleId) return;

    // Check if this is the base role being moved
    if (newRole.id === baseRoleId) {
      // Base role was moved, reposition all booster roles below it
      await repositionAllBoosterRoles(newRole.guild, baseRoleId);
      return;
    }

    // Check if this is a booster role
    const boosterRole = await guildService.getBoosterRoleByRoleId(newRole.guild.id, newRole.id);
    if (!boosterRole) return;

    // This is a booster role, ensure it's positioned correctly
    const baseRole = newRole.guild.roles.cache.get(baseRoleId);
    if (!baseRole) return;

    // If booster role is above base role, move it below
    if (newRole.position >= baseRole.position) {
      const targetPosition = Math.max(1, baseRole.position - 1);
      try {
        await newRole.edit({ position: targetPosition });

        // Update last used time since role was modified
        await guildService.updateBoosterRoleLastUsed(newRole.guild.id, boosterRole.id);
      } catch (error) {
        // Silent fail if can't reposition role
      }
    }

  } catch (error) {
    // Silent fail for booster role hierarchy management
  }
}

// Reposition all booster roles below the base role
async function repositionAllBoosterRoles(guild, baseRoleId) {
  try {
    const guildService = getService('guild');
    
    const baseRole = guild.roles.cache.get(baseRoleId);
    if (!baseRole) return;

    const boosterRoles = await guildService.getBoosterRoles(guild.id);
    if (boosterRoles.length === 0) return;

    // Get all Discord roles for booster roles
    const discordBoosterRoles = boosterRoles
      .map(br => guild.roles.cache.get(br.roleId))
      .filter(role => role); // Filter out deleted roles

    if (discordBoosterRoles.length === 0) return;

    // Sort booster roles by their current position (highest first)
    discordBoosterRoles.sort((a, b) => b.position - a.position);

    // Position each booster role below the base role
    let targetPosition = Math.max(1, baseRole.position - 1);

    for (const role of discordBoosterRoles) {
      try {
        if (role.position >= baseRole.position) {
          await role.edit({ position: targetPosition });
          targetPosition = Math.max(1, targetPosition - 1);

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        // Continue with other roles if one fails
      }
    }

  } catch (error) {
    // Silent fail for bulk repositioning
  }
}
