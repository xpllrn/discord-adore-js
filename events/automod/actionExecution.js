const { EmbedBuilder } = require('discord.js');
const { colors } = require('../../config/setup');

module.exports = {
  name: 'autoModerationActionExecution',
  async execute(autoModerationActionExecution, client) {
    try {
      // Skip if not from our AutoMod rule
      const rule = autoModerationActionExecution.autoModerationRule;
      if (!rule || rule.name !== 'Adore AutoMod') {
        return;
      }

      const guild = autoModerationActionExecution.guild;
      const user = autoModerationActionExecution.user;
      const channel = autoModerationActionExecution.channel;
      const content = autoModerationActionExecution.content;
      const matchedKeyword = autoModerationActionExecution.matchedKeyword;

      // Log the action (optional - you can remove this if you don't want logging)
      console.log(`AutoMod triggered in ${guild.name}: User ${user.tag} used filtered word "${matchedKeyword}" in #${channel.name}`);

      // You can add additional custom actions here if needed
      // For example, sending a log message to a specific channel
      
    } catch (error) {
      // Silent fail for AutoMod action execution
      console.error('AutoMod action execution error:', error);
    }
  }
};
