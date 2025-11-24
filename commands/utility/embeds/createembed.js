const { ensureGuildData } = require('../../../database')
const { MessageProcessor } = require('../../../utils/embeds/embedbuilder')
const { embeds } = require('../../../core/embeds')
const { runHelpCommand } = require('../../../utils/commandProcessor')
const logger = require('../../../utils/logger');

module.exports = {
  name: "createembed",
  aliases: ['ce'],
  description: "Create your own embed, You can use [**embed website**](https://adore.vly.site/embeds) to your own embeds",
  syntax: 'createembed (code)',
  example: 'createembed {title: Hello}',
  permission: "Manage Messages",
  run: async (client, message, args) => {

    await ensureGuildData(message.guild.id);

    if (!args[0]) {
      return runHelpCommand(message, 'createembed');
    }

    const input = args.join(' ');

    try {
      let embedInput = input;
      if (!input.trim().startsWith('{embed}')) {
        embedInput = `{embed}$v${input}`;
      }

      const variables = {
        user: message.author,
        guild: message.guild,
        channel: message.channel
      };

      return MessageProcessor.process(message.channel, embedInput, variables);

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, `Invalid embed syntax: ${error.message || 'Please check your format.'}`);
    }
  }
}