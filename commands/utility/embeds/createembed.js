const { ensureGuildData } = require('../../../database')
const { MessageProcessor } = require('../../../utils/embeds/embedbuilder')
const { CustomContainerBuilder } = require('../../../utils/embeds/containerbuilder')
const { embeds } = require('../../../core/embeds')
const { runHelpCommand } = require('../../../utils/commandProcessor')
const logger = require('../../../utils/logger');

module.exports = {
  name: "createembed",
  aliases: ['ce'],
  description: "Create your own embed or container. Use `{embed}` for old embeds or `{container}`/`{v2}` for Components V2",
  syntax: 'createembed (code)',
  example: 'createembed {title: Hello} OR createembed {v2}$v{text: # Hello}',
  permission: "manage_messages",
  run: async (client, message, args) => {

    await ensureGuildData(message.guild.id);

    if (!args[0]) {
      return runHelpCommand(message, 'createembed');
    }

    const input = args.join(' ');

    try {
      const variables = {
        user: message.author,
        guild: message.guild,
        channel: message.channel
      };

      // Check if it's a Components V2 container
      if (input.trim().startsWith('{container}') || input.trim().startsWith('{v2}')) {
        // Components V2 mode
        let containerInput = input.replace(/^\s*{container}\s*\$v\s*/, '').replace(/^\s*{v2}\s*\$v\s*/, '');

        return new CustomContainerBuilder(message.channel, containerInput, variables, message);
      } else {
        // Old embed mode
        let embedInput = input;
        if (!input.trim().startsWith('{embed}')) {
          embedInput = `{embed}$v${input}`;
        }

        return MessageProcessor.process(message.channel, embedInput, variables, message);
      }

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, `Invalid syntax: ${error.message || 'Please check your format.'}`);
    }
  }
}