const { embeds } = require('../../../../core/embeds');
const { getService } = require('@services');

module.exports = {
  name: 'blacklists',
  description: 'View all blacklisted users in counting',
  syntax: 'count blacklists',
  example: 'count blacklists',
  run: async (client, message, args) => {
    const guildService = getService('guild');
    
    if (!message.member.permissions.has('ManageGuild')) {
      return embeds.permission(message, 'Manage Guild');
    }

    const countingData = await guildService.getCounting(message.guild.id);
    
    if (!countingData.channelId) {
      return embeds.deny(message, 'Please set a counting channel first using `count channel #channel`.');
    }

    if (!countingData.ignoredUsers || countingData.ignoredUsers.length === 0) {
      return embeds.info(message, 'There are no **blacklisted users** in the counting system');
    }

    const userList = await Promise.all(
      countingData.ignoredUsers.map(async (userId, index) => {
        try {
          const user = await client.users.fetch(userId);
          return `${index + 1}. **${user.tag}** (${userId})`;
        } catch {
          return `${index + 1}. Unknown User (${userId})`;
        }
      })
    );

    return embeds.info(message, `**Blacklisted Users (${countingData.ignoredUsers.length}):**\n${userList.join('\n')}`);
  }
};
