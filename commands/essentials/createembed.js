const { ensureGuildData } = require('../../database')
const { MessageProcessor } = require('../../utils/embedbuilder')
const { embeds } = require('../../core/embeds')
const { runHelpCommand } = require('../../utils/commandProcessor')

module.exports = {
  name: "createembed",
  aliases: ['ce'],
  description: "Create your own embed",
  usage: `{guildprefix}createembed [embed code]
{guildprefix}createembed {title: Hello {user}}$v{description: Welcome to {guild.name}}`,
  permission: "Manage Messages",
  run: async(client, message, args) => {

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
      return embeds.deny(message, 'Invalid embed syntax. Please check your format.');
    }
  }
}