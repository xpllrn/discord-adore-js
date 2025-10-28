/**
 * Sprint cleanup utilities for handling edge cases and maintenance
 */

// Get Sprint model from database
function getSprintModel() {
  const { getModels } = require('../database');
  const models = getModels();
  return models ? models.Sprint : null;
}

/**
 * Clean up expired sprints that weren't properly ended
 */
async function cleanupExpiredSprints(client) {
  try {
    const Sprint = getSprintModel();
    if (!Sprint) {
      console.log('[Sprint Cleanup] Database not ready');
      return;
    }

    const now = new Date();
    const expiredSprints = await Sprint.find({
      isActive: true,
      endTime: { $lt: now }
    });

    console.log(`[Sprint Cleanup] Found ${expiredSprints.length} expired sprints to clean up`);

    for (const sprint of expiredSprints) {
      try {
        const { autoEndSprint } = require('./sprintManager');
        await autoEndSprint(client, sprint.guildId, sprint.messageId);
        console.log(`[Sprint Cleanup] Cleaned up expired sprint ${sprint.messageId}`);
      } catch (error) {
        console.error(`[Sprint Cleanup] Failed to clean up sprint ${sprint.messageId}:`, error);
        
        // Force mark as inactive if auto-end fails
        sprint.isActive = false;
        await sprint.save();
      }
    }

    return expiredSprints.length;
  } catch (error) {
    console.error('[Sprint Cleanup] Error during cleanup:', error);
    return 0;
  }
}

/**
 * Remove orphaned sprint data (sprints with invalid message/channel references)
 */
async function cleanupOrphanedSprints(client) {
  try {
    const Sprint = getSprintModel();
    if (!Sprint) return 0;

    const activeSprints = await Sprint.find({ isActive: true });
    let cleanedCount = 0;

    for (const sprint of activeSprints) {
      try {
        // Try to fetch the channel and message
        const channel = await client.channels.fetch(sprint.channelId);
        if (channel) {
          await channel.messages.fetch(sprint.messageId);
        }
      } catch (error) {
        // Channel or message doesn't exist, mark sprint as inactive
        console.log(`[Sprint Cleanup] Removing orphaned sprint ${sprint.messageId} (channel/message not found)`);
        sprint.isActive = false;
        await sprint.save();
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[Sprint Cleanup] Removed ${cleanedCount} orphaned sprints`);
    }

    return cleanedCount;
  } catch (error) {
    console.error('[Sprint Cleanup] Error during orphan cleanup:', error);
    return 0;
  }
}

/**
 * Run full sprint maintenance
 */
async function runSprintMaintenance(client) {
  console.log('[Sprint Cleanup] Starting sprint maintenance...');
  
  const expiredCount = await cleanupExpiredSprints(client);
  const orphanedCount = await cleanupOrphanedSprints(client);
  
  console.log(`[Sprint Cleanup] Maintenance complete - ${expiredCount} expired, ${orphanedCount} orphaned`);
  
  return { expiredCount, orphanedCount };
}

module.exports = {
  cleanupExpiredSprints,
  cleanupOrphanedSprints,
  runSprintMaintenance
};