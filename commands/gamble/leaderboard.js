const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { getQueryOptimizer } = require('../../database/utils/QueryOptimizer');
const { colors } = require('../../config/setup');

// Utility functions embedded within the command
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "leaderboard",
  aliases: ['lb', 'top', 'rich'],
  description: 'View the top 10 richest users in server or globally',
  syntax: 'leaderboard [global]',
  example: 'leaderboard\nlb global',
  run: async (client, message, args) => {

    try {
      const userService = getService('user');
      const isGlobal = args[0] && args[0].toLowerCase() === 'global';

      let userIds = [];
      let scopeTitle = '';

      if (isGlobal) {
        // Get all users from database globally
        try {
          const allUsers = await userService.getAllUsersWithGamblingData();
          userIds = allUsers.map(user => user.UserID);
          scopeTitle = 'Global Wealth Leaderboard';
        } catch (error) {
          console.error('Error fetching global users:', error);
          return embeds.deny(message, 'An error occurred while fetching global leaderboard data');
        }
      } else {
        // Get users from current guild only
        const guildMembers = await message.guild.members.fetch();
        userIds = Array.from(guildMembers.keys());
        scopeTitle = `Wealth Leaderboard in ${message.guild.name}`;
      }

      if (userIds.length === 0) {
        const scope = isGlobal ? 'globally' : 'in this server';
        return embeds.warn(message, `No users found ${scope}`);
      }

      // Get gambling data for all users using batch operation
      const gamblingDataMap = await userService.batchGetGamblingData(userIds);

      // Process users and calculate wealth (include all users for ranking)
      const allUsersWithWealth = [];
      const usersWithPositiveWealth = [];

      for (const [userId, gamblingData] of gamblingDataMap) {
        const wallet = gamblingData.wallet || 0;
        const bank = gamblingData.bank || 0;
        const totalWealth = wallet + bank;

        const userEntry = {
          UserID: userId,
          totalWealth: totalWealth
        };

        // Add to all users list for ranking calculation
        allUsersWithWealth.push(userEntry);

        // Add to positive wealth list for display (if they have money)
        if (totalWealth > 0) {
          usersWithPositiveWealth.push(userEntry);
        }
      }

      if (usersWithPositiveWealth.length === 0) {
        return embeds.warn(message, 'No users found with gambling data');
      }

      // Sort ALL users by wealth to get accurate positions
      const sortedAllUsers = allUsersWithWealth.sort((a, b) => b.totalWealth - a.totalWealth);
      const userPosition = sortedAllUsers.findIndex(user => user.UserID === message.author.id) + 1;

      // Sort users with positive wealth for display
      const sortedUsers = usersWithPositiveWealth.sort((a, b) => b.totalWealth - a.totalWealth);

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
        return `\`${position.toString().padStart(2, '0')}\` **${username}** - \`${formatCurrency(totalWealth)}\``;
      }));

      // Footer shows user position like levels/swear leaderboard
      const footerText = userPosition > 0
        ? `Your position: #${userPosition}`
        : 'You are not ranked';

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(scopeTitle)
        .setDescription(userList.join('\n'))
        .setFooter({ text: footerText });

      await message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error in leaderboard command:', error);
      return embeds.deny(message, 'An error occurred while fetching the leaderboard from cache');
    }
  }
};
