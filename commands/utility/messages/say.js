const { PermissionFlagsBits } = require("discord.js");
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const { embeds } = require('../../../core/embeds');
const logger = require('../../../utils/logger');

module.exports = {
  name: "say",
  description: "Say a message",
  syntax: 'say (message)',
  example: 'say hello world',
  permission: "administrator",
  run: async (client, message, args) => {
    try {
      if (!hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator')) return;

      const text = args.join(" ");
      if (!text) {
        return runHelpCommand(message, 'say');
      }

      await message.channel.send(text);
    } catch (error) {
      throw error;
    }
  },
};
