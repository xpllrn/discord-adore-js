const snipeCache = require('../../database/cache/snipeCache');
const webhookLogger = require('../../utils/webhookLogger');

module.exports = {
  name: 'messageDelete',
  async execute(message, client) {

    if (!message.author || message.author.bot) return;

    snipeCache.addDeletedMessage(message);

    // Send webhook log if configured
    await logMessageDelete(message);
  },
};

async function logMessageDelete(message) {
  try {
    if (!message.guild) return;

    const logResult = webhookLogger.createMessageLog({
      action: 'delete',
      message: message,
      author: message.author,
      channel: message.channel
    });

    await webhookLogger.sendLog(message.guild.id, 'message', logResult.embed, logResult.files);
  } catch (error) {
    // Send error to webhook instead of console
    if (message.client?.errorLogger) {
      message.client.errorLogger.log(error, 'Message Delete Logging', {
        command: 'Message Delete Event',
        args: `Channel: ${message.channel?.name || 'Unknown'}`,
        user: message.author,
        guild: message.guild,
        channel: message.channel
      });
    }
  }
}
