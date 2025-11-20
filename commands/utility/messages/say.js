const { PermissionFlagsBits } = require("discord.js");
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');

module.exports = {
  name: "say",
  description: "Say a message",
  syntax: 'say (message)',
  example: 'say hello world',
  permission: "Administrator",
  run: async (client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator')) return;

    const text = args.join(" ");
    if (!text) {
      return runHelpCommand(message, 'say');
    }

    await message.channel.send(text);
  },
};
