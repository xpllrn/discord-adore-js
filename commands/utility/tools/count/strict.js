const { embeds } = require('../../../../core/embeds');
const { getService } = require('@services');
const { runHelpCommand } = require('../../../../utils/commandProcessor');

module.exports = {
  name: 'strict',
  description: 'Toggle strict mode for counting',
  syntax: 'count strict <on/off>',
  example: 'count strict on',
  run: async (client, message, args) => {
    const guildService = getService('guild');
    
    if (!message.member.permissions.has('ManageGuild')) {
      return embeds.permission(message, 'Manage Guild');
    }

    const countingData = await guildService.getCounting(message.guild.id);
    
    if (!countingData.channelId) {
      return embeds.deny(message, 'Please set a counting channel first using `count channel #channel`.');
    }

    const mode = args[0]?.toLowerCase();
    
    if (mode === 'on') {
      countingData.strict = true;
      await guildService.setCounting(message.guild.id, countingData);
      return embeds.success(message, '**Strict mode** has been **enabled**. Wrong counts will reset the game');
    } else if (mode === 'off') {
      countingData.strict = false;
      await guildService.setCounting(message.guild.id, countingData);
      return embeds.success(message, '**Strict mode** has been **disabled**. Wrong counts will be ignored but the game continues');
    } else {
      return runHelpCommand(message, 'count', 'strict');
    }
  }
};
