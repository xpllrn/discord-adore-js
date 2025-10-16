const snipeCache = require('../../database/cache/snipe');
const webhookLogger = require('../../utils/webhookLogger');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, client) {

    if (!oldMessage.author || oldMessage.author.bot) return;
    snipeCache.addEditedMessage(oldMessage, newMessage);

    // Send webhook log if configured
    await logMessageEdit(oldMessage, newMessage);

    processEditedCommand(newMessage, client);
  },
};

async function logMessageEdit(oldMessage, newMessage) {
  try {
    if (!newMessage.guild) return;

    // Skip if content is the same (embed updates, etc.)
    if (oldMessage.content === newMessage.content) return;

    const logResult = webhookLogger.createMessageLog({
      action: 'edit',
      message: newMessage,
      oldMessage: oldMessage,
      author: newMessage.author,
      channel: newMessage.channel
    });

    await webhookLogger.sendLog(newMessage.guild.id, 'message', logResult.embed, logResult.files);
  } catch (error) {
    // Send error to webhook instead of console
    if (newMessage.client?.errorLogger) {
      newMessage.client.errorLogger.log(error, 'Message Edit Logging', {
        command: 'Message Edit Event',
        args: `Channel: ${newMessage.channel?.name || 'Unknown'}`,
        user: newMessage.author,
        guild: newMessage.guild,
        channel: newMessage.channel
      });
    }
  }
}

async function processEditedCommand(message, client) {
  try {
    const { processCommand } = require('../../utils/commandProcessor');
    await processCommand(message, true);
  } catch (error) {

  }
}
