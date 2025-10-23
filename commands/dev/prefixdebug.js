const { embeds } = require('../../core/embeds');
const { getGuildPrefix } = require('../../utils/commandProcessor');

module.exports = {
  name: "prefixdebug",
  aliases: ['pd', 'debugprefix'],
  description: `Debug prefix system`,
  usage: `{guildprefix}prefixdebug`,
  permission: 'dev',

  run: async (_, message, args) => {
    try {
      // Get cache manager
      const { getCacheManager } = require('../../database/cache/core/CacheManager');
      const cacheManager = getCacheManager();

      // Get current prefix from cache
      const cachedPrefix = await getGuildPrefix(message.guild.id);

      // Get prefix directly from database
      const { Guild } = require('../../database');
      let dbPrefix = ','; // default
      try {
        const guildDoc = await Guild.findOne({ GuildID: message.guild.id });
        if (guildDoc && guildDoc.Prefix) {
          dbPrefix = guildDoc.Prefix;
        }
      } catch (error) {
        dbPrefix = `Error: ${error.message}`;
      }

      // Get cache status
      const cacheStats = cacheManager.getStats();
      const writesEnabled = cacheManager.guildCache.areWritesEnabled();
      const cacheReady = cacheManager.isReady();

      const description = [
        `**Guild ID:** \`${message.guild.id}\``,
        `**Cached Prefix:** \`${cachedPrefix}\``,
        `**Database Prefix:** \`${dbPrefix}\``,
        `**Cache Writes Enabled:** ${writesEnabled ? '✅' : '❌'}`,
        `**Cache System Ready:** ${cacheReady ? '✅' : '❌'}`,
        `**Guild Cache Size:** ${cacheStats.guild.size}`,
        `**Guild Cache Hits:** ${cacheStats.guild.hits}`,
        `**Guild Cache Misses:** ${cacheStats.guild.misses}`
      ].join('\n');

      return embeds.info(message, description);

    } catch (error) {
      return embeds.deny(message, `Debug error: ${error.message}`);
    }
  }
};