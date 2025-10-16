const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getCacheManager } = require('../../database/cache');
const { getQueryOptimizer } = require('../../database/utils/QueryOptimizer');
const { colors } = require('../../config/setup');

// Utility functions embedded within the command
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "leaderboard",
  aliases: ['lb', 'top', 'rich'],
  description: 'View the top 10 richest users globally',
  usage: `{guildprefix}leaderboard`,
  run: async(client, message, args) => {

    try {
      const cacheManager = getCacheManager();

      if (!cacheManager.isReady()) {
        return embeds.warn(message, 'Cache system is still loading. Please try again in a moment.');
      }

      // Get all cached user keys
      const userKeys = cacheManager.userCache.keys();

      if (userKeys.length === 0) {
        return embeds.warn(message, 'No users found with gambling data');
      }

      // Process users from cache
      const usersWithWealth = [];

      for (const userId of userKeys) {
        try {
          const userData = await cacheManager.userCache.get(userId);
          if (userData && userData.Gambling) {
            const wallet = userData.Gambling.wallet || 0;
            const bank = userData.Gambling.bank || 0;
            const totalWealth = wallet + bank;

            if (totalWealth > 0) {
              usersWithWealth.push({
                UserID: userId,
                totalWealth: totalWealth
              });
            }
          }
        } catch (error) {
          // Skip users with cache errors
          continue;
        }
      }

      if (usersWithWealth.length === 0) {
        return embeds.warn(message, 'No users found with gambling data');
      }

      // Sort by wealth and get user position
      const sortedUsers = usersWithWealth.sort((a, b) => b.totalWealth - a.totalWealth);
      const userPosition = sortedUsers.findIndex(user => user.UserID === message.author.id) + 1;

      // Take top 10 for display
      const topUsers = sortedUsers.slice(0, 10);

      // Format all users in a single embed
      const userList = await Promise.all(topUsers.map(async (user, index) => {
        const position = index + 1;
        const totalWealth = user.totalWealth || 0;

        // Try to get username from client cache first, then try to fetch
        let username = 'Unknown user';
        try {
          if (user.UserID && typeof user.UserID === 'string' && user.UserID !== 'null') {
            let discordUser = client.users.cache.get(user.UserID);

            // If not in cache, try to fetch (but don't wait too long)
            if (!discordUser) {
              try {
                discordUser = await Promise.race([
                  client.users.fetch(user.UserID),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                ]);
              } catch (fetchError) {
                // User might have left Discord, use fallback
              }
            }

            if (discordUser) {
              username = discordUser.username;
            } else {
              // Show partial user ID as fallback
              username = `User ${user.UserID.slice(-4)}`;
            }
          }
        } catch (error) {
          // Keep default username if user not found
        }

        // Format like levels/swear leaderboard: `01` **Username** - Amount
        return `\`${position.toString().padStart(2, '0')}\` **${username}** - ${formatCurrency(totalWealth)}`;
      }));

      // Footer shows user position like levels/swear leaderboard
      const footerText = userPosition > 0
        ? `Your position: #${userPosition}`
        : 'You are not ranked';

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle('Wealth Leaderboard')
        .setDescription(userList.join('\n'))
        .setFooter({ text: footerText });

      await message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error in leaderboard command:', error);
      return embeds.deny(message, 'An error occurred while fetching the leaderboard from cache');
    }
  }
};
