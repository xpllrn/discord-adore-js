// Nuke scheduler handler - runs every minute to check for scheduled nukes

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    setupNukeScheduler(client);
  }
};

// Track last error to prevent spam
let lastErrorTime = 0;
const ERROR_COOLDOWN = 5 * 60 * 1000; // 5 minutes

function setupNukeScheduler(client) {
  // Run nuke check every minute (60000 ms)
  setInterval(async () => {
    await checkScheduledNukes(client);
  }, 60000); // 1 minute

  // Also run immediately on startup (after 30 seconds to allow database to connect)
  setTimeout(() => checkScheduledNukes(client), 30000);
}

async function checkScheduledNukes(client) {
  try {
    const { getModels } = require('../../database');
    const guildCache = require('../../database/cache/models/guild');

    // Get database models
    const models = getModels();
    if (!models || !models.Guild) {
      return; // Database not ready
    }

    const now = new Date();

    // Get all guilds that have scheduled nukes
    const guildsWithNukes = await models.Guild.find({
      'ScheduledNukes.0': { $exists: true }
    }).select('GuildID ScheduledNukes').maxTimeMS(5000); // 5 second timeout

    if (!guildsWithNukes || guildsWithNukes.length === 0) {
      return; // No scheduled nukes to process
    }

    for (const guildData of guildsWithNukes) {
      try {
        if (!guildData || !guildData.GuildID) {
          continue; // Skip invalid guild data
        }

        const guildId = guildData.GuildID;
        const guild = client.guilds.cache.get(guildId);
        
        if (!guild) {
          continue; // Bot not in guild anymore
        }

        // Get scheduled nukes from cache
        const scheduledNukes = await guildCache.getScheduledNukes(guildId);
        
        if (!scheduledNukes || scheduledNukes.length === 0) {
          continue; // No scheduled nukes
        }

        for (const nuke of scheduledNukes) {
          try {
            if (!nuke.enabled || !nuke.nextNuke) {
              continue; // Skip disabled or invalid nukes
            }

            const nextNukeTime = new Date(nuke.nextNuke);
            
            if (now >= nextNukeTime) {
              // Time to nuke!
              const channel = guild.channels.cache.get(nuke.channelId);
              
              if (!channel) {
                // Channel doesn't exist anymore, remove the scheduled nuke
                await guildCache.removeScheduledNuke(guildId, nuke.channelId);
                continue;
              }

              // Check if bot has permissions
              if (!guild.members.me.permissions.has('ManageChannels')) {
                continue; // Skip if no permissions
              }

              // Execute the nuke
              await executeScheduledNuke(guild, channel, nuke.message);

              // Calculate next nuke time
              const nextNuke = new Date(now.getTime() + nuke.interval);
              await guildCache.updateNextNukeTime(guildId, nuke.channelId, nextNuke);
            }
          } catch (nukeError) {
            // Silent fail for individual nuke processing
            console.error(`Error processing scheduled nuke for ${guildId}-${nuke.channelId}:`, nukeError);
          }
        }
      } catch (guildError) {
        // Silent fail for individual guild processing
        console.error(`Error processing scheduled nukes for guild ${guildData.GuildID}:`, guildError);
      }
    }

  } catch (error) {
    // Only log errors occasionally to prevent spam
    const now = Date.now();
    if (now - lastErrorTime > ERROR_COOLDOWN) {
      console.error('Error in nuke scheduler:', error);
      lastErrorTime = now;
    }
  }
}

async function executeScheduledNuke(guild, channel, message = 'first') {
  try {
    // Store channel information
    const channelName = channel.name;
    const channelParent = channel.parent;
    const channelPosition = channel.position;
    const channelTopic = channel.topic;
    const channelNsfw = channel.nsfw;
    const channelRateLimitPerUser = channel.rateLimitPerUser;

    // Check if this channel is used for any server features using cache
    const guildCache = require('../../database/cache/models/guild');
    const featuresToRestore = [];

    try {
      // Check all possible channel features using cache methods
      const welcomeChannel = await guildCache.getWelcomeChannel(guild.id);
      const boostChannel = await guildCache.getBoostChannel(guild.id);

      if (welcomeChannel === channel.id) {
        featuresToRestore.push('Welcome Channel');
      }
      if (boostChannel === channel.id) {
        featuresToRestore.push('Boost Channel');
      }
    } catch (error) {
      // Silent fail for feature checking
    }

    // Clone the channel
    const newChannel = await channel.clone({
      name: channelName,
      topic: channelTopic,
      nsfw: channelNsfw,
      rateLimitPerUser: channelRateLimitPerUser,
      reason: 'Scheduled nuke executed'
    });

    // Set parent and position
    if (channelParent) {
      await newChannel.setParent(channelParent);
    }
    await newChannel.setPosition(channelPosition);

    // Delete the old channel
    await channel.delete('Scheduled nuke executed');

    // Restore server features if any were using this channel
    if (featuresToRestore.length > 0) {
      try {
        const welcomeChannel = await guildCache.getWelcomeChannel(guild.id);
        const boostChannel = await guildCache.getBoostChannel(guild.id);

        if (welcomeChannel === channel.id) {
          await guildCache.setWelcomeChannel(guild.id, newChannel.id);
        }
        if (boostChannel === channel.id) {
          await guildCache.setBoostChannel(guild.id, newChannel.id);
        }
      } catch (error) {
        // Silent fail for feature restoration
      }
    }

    // Update the scheduled nuke's channel ID to the new channel
    await guildCache.removeScheduledNuke(guild.id, channel.id);
    const scheduledNukes = await guildCache.getScheduledNukes(guild.id);
    const nukeData = scheduledNukes.find(n => n.channelId === channel.id);
    
    if (nukeData) {
      // Re-add with new channel ID
      await guildCache.addScheduledNuke(guild.id, {
        ...nukeData,
        channelId: newChannel.id
      });
    }

    // Send the custom message in new channel
    await newChannel.send(message);

  } catch (error) {
    console.error(`Error executing scheduled nuke for ${guild.id}-${channel.id}:`, error);
  }
}
