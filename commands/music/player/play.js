const { PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const musicPlayer = require('../../../utils/musicPlayer');
const logger = require('../../../utils/logger');

module.exports = {
  name: "play",
  aliases: ['p'],
  description: 'Play music from YouTube in your voice channel',
  syntax: 'play <song name or URL>',
  example: 'play never gonna give you up',
  run: async(client, message, args) => {
    try {
      // Check if user is in a voice channel
      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) {
        return embeds.warn(message, 'You need to be in a **voice channel** to play music!');
      }

      // Check bot permissions
      const permissions = voiceChannel.permissionsFor(message.guild.members.me);
      if (!permissions.has(PermissionFlagsBits.Connect)) {
        return embeds.warn(message, 'I don\'t have permission to **join** your voice channel!');
      }
      if (!permissions.has(PermissionFlagsBits.Speak)) {
        return embeds.warn(message, 'I don\'t have permission to **speak** in your voice channel!');
      }

      // Check if query provided
      if (!args[0]) {
        return runHelpCommand(message, 'play');
      }

      const query = args.join(' ');

      // Send searching message
      await message.channel.sendTyping();

      // Search for the song
      const song = await musicPlayer.searchSong(query);

      if (!song) {
        return embeds.warn(message, 'No results found for your query.');
      }

      // Join voice channel if not already connected
      const queue = musicPlayer.getQueue(message.guild.id);
      if (!queue.connection) {
        try {
          await musicPlayer.joinChannel(voiceChannel, message.channel);
        } catch (error) {
          logger.console.error('Failed to join voice channel:', error);
          return embeds.warn(message, 'Failed to join voice channel!');
        }
      }

      // Add song to queue
      await musicPlayer.addSong(message.guild.id, song, message.author);

    } catch (error) {
      logger.webhook.error(error, 'Play Command', {
        user: message.author,
        guild: message.guild,
        channel: message.channel,
        command: 'play',
        args: args.join(' ')
      });
      embeds.warn(message, 'An error occurred while trying to play music.');
    }
  }
};
