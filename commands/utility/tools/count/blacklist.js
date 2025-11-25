const { embeds } = require('../../../../core/embeds');
const { getService } = require('@services');
const { runHelpCommand } = require('../../../../utils/commandProcessor');

module.exports = {
  name: 'blacklist',
  description: 'Toggle blacklist for a user in counting',
  syntax: 'count blacklist <user>',
  example: 'count blacklist @user',
  run: async (client, message, args) => {
    const guildService = getService('guild');
    
    if (!message.member.permissions.has('ManageGuild')) {
      return embeds.permission(message, 'Manage Guild');
    }

    const countingData = await guildService.getCounting(message.guild.id);
    
    if (!countingData.channelId) {
      return embeds.deny(message, 'Please set a counting channel first using `count channel #channel`.');
    }

    const user = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
    
    if (!user) {
      return runHelpCommand(message, 'count', 'blacklist');
    }

    if (!countingData.ignoredUsers) {
      countingData.ignoredUsers = [];
    }

    // Toggle blacklist
    if (countingData.ignoredUsers.includes(user.id)) {
      countingData.ignoredUsers = countingData.ignoredUsers.filter(id => id !== user.id);
      await guildService.setCounting(message.guild.id, countingData);
      return embeds.success(message, `**${user.tag}** is no longer **blacklisted** in the counting system`);
    } else {
      countingData.ignoredUsers.push(user.id);
      await guildService.setCounting(message.guild.id, countingData);
      return embeds.success(message, `**${user.tag}** is now **blacklisted** in the counting system`);
    }
  }
};
