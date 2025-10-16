// Autopost restore handler - restores autopost intervals when bot starts

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    setupAutopostRestore(client);
  }
};

/**
 * Set up autopost restoration for all guilds
 * @param {Client} client - Discord client
 */
function setupAutopostRestore(client) {
  setTimeout(async () => {
    const guildCache = require('../../database/cache/models/guild');
    const { setupAutopost } = require('../../commands/server/autopost');

    let restoredCount = 0;

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const autopostChannels = await guildCache.getAutopostChannels(guildId) || [];

        if (autopostChannels.length > 0) {
          for (const autopost of autopostChannels) {
            const channel = guild.channels.cache.get(autopost.channelId);
            if (channel && autopost.enabled) {
              // Calculate proper timing instead of posting immediately
              const shouldPostImmediately = calculateShouldPostImmediately(autopost);
              setupAutopost(client, guildId, autopost.channelId, autopost.category, shouldPostImmediately);
              restoredCount++;
            } else if (!channel) {
              await guildCache.removeAutopostChannel(guildId, autopost.channelId);
            }
          }
        }

        const legacyEnabled = await guildCache.getField(guildId, 'AutopostEnabled');
        const legacyChannel = await guildCache.getField(guildId, 'AutopostChannel');
        const legacyCategory = await guildCache.getField(guildId, 'AutopostCategory');

        if (legacyEnabled && legacyChannel && legacyCategory) {
          const channel = guild.channels.cache.get(legacyChannel);
          if (channel) {
            await guildCache.addAutopostChannel(guildId, {
              channelId: legacyChannel,
              category: legacyCategory,
              enabled: true,
              createdAt: new Date(),
              createdBy: 'system_migration'
            });

            setupAutopost(client, guildId, legacyChannel, legacyCategory, false);
            restoredCount++;
          }

          await guildCache.setField(guildId, 'AutopostEnabled', null);
          await guildCache.setField(guildId, 'AutopostChannel', null);
          await guildCache.setField(guildId, 'AutopostCategory', null);
        }
      } catch {}
    }
  }, 5000);
}

/**
 * Calculate whether autopost should post immediately on restart
 * @param {Object} autopost - Autopost configuration
 * @returns {boolean} - Whether to post immediately
 */
function calculateShouldPostImmediately(autopost) {
  // If no lastPosted timestamp, post immediately (first time setup)
  if (!autopost.lastPosted) {
    return true;
  }

  const now = new Date();
  const lastPosted = new Date(autopost.lastPosted);
  const intervalTime = process.env.AUTOPOST_TEST_MODE === 'true' ? 60000 : 300000; // 1 min or 5 min

  // Calculate when the next post should be
  const nextPostTime = new Date(lastPosted.getTime() + intervalTime);

  // If we're past the next post time, post immediately
  // Otherwise, let the interval handle it at the proper time
  return now >= nextPostTime;
}