const { embeds } = require('../../../../core/embeds');
const { getService } = require('@services');

module.exports = {
  name: 'config',
  description: 'View current counting configuration',
  syntax: 'count config',
  example: 'count config',
  run: async (client, message, args) => {
    const guildService = getService('guild');
    
    if (!message.member.permissions.has('ManageGuild')) {
      return embeds.permission(message, 'Manage Guild');
    }

    const countingData = await guildService.getCounting(message.guild.id);
    
    if (countingData.channelId) {
      const strictMode = countingData.strict !== false ? 'on' : 'off';
      const status = countingData.enabled !== false ? 'enabled' : 'disabled';
      return embeds.info(message, `The counting channel is <#${countingData.channelId}>.\nStatus: **${status}**\nStrict mode: **${strictMode}**\nCurrent count: **${countingData.currentCount}**`);
    } else {
      return embeds.info(message, `There is no counting channel set.`);
    }
  }
};
