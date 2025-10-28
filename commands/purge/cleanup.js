const { PermissionFlagsBits } = require("discord.js");
const { embeds } = require('../../core/embeds');
const { runHelpCommand } = require('../../utils/commandProcessor');

module.exports = {
  name: "cleanup",
  aliases: ['bc'],
  description: `clean up bot messages and user commands in the channel`,
  syntax: 'cleanup (number)',
  example: 'cleanup 50',
  permission: 'Manage Messages',
  run: async(client, message, args) => {

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return embeds.deny(message, 'I need **Manage Messages** permission to use this command');
    }

    let number = 50;

    if (args[0]) {
      const inputNumber = parseInt(args[0]);

      if (isNaN(inputNumber) || inputNumber < 1) {
        return runHelpCommand(message, 'cleanup');
      }

      number = Math.min(inputNumber, 500);
    }

    try {
      // Fetch messages
      const messages = await message.channel.messages.fetch({ limit: number });

      // Define command prefixes to detect user commands
      const commandPrefixes = [';', ',', '!', '$', '?', '/', '.', ':', "'", '"', '-', '_', '+', '=', '^', '&'];

      const messagesToDelete = messages.filter(msg => {
        // Delete bot messages
        if (msg.author.bot) return true;

        // Delete the invoking command message
        if (msg.id === message.id) return true;

        // Delete user messages that start with command prefixes
        if (!msg.author.bot && msg.content && msg.content.trim()) {
          const firstChar = msg.content.trim().charAt(0);
          if (commandPrefixes.includes(firstChar)) return true;
        }

        return false;
      });

      if (messagesToDelete.size === 0) {
        return; // Silent fail - no messages to delete
      }

      await message.channel.bulkDelete(messagesToDelete, true);
      // No confirmation message - delete silently

    } catch (error) {
      if (error.code === 50034) {
        embeds.deny(message, 'Cannot delete messages **older than 14 days** due to Discord limitations.');
      } else {
        embeds.deny(message, 'An error occurred while trying to clean up messages.');
      }
    }
  }
}