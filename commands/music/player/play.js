const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { runHelpCommand } = require('../../../utils/commandProcessor');
const musicPlayer = require('../../../utils/musicPlayer');
const config = require('../../../config/setup');
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
      const position = await musicPlayer.addSong(message.guild.id, song, message.author);

      // Send response based on queue position
      if (position === 1 && !musicPlayer.isPlaying(message.guild.id)) {
        // Song will start playing immediately - the musicPlayer will send the now playing message
        return;
      } else {
        // Song added to queue
        const embed = new EmbedBuilder()
          .setColor(0xFFFFFF)
          .setDescription(
            `${config.emojis.music} ${message.author}: Added [\`${song.title}\`](${song.url}) by \`${song.author}\` to the queue`
          );

        await message.channel.send({ embeds: [embed] });
      }

      // Monitor voice channel for user leaving
      monitorVoiceChannel(client, message.guild.id, voiceChannel.id, message.author.id);

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

// Monitor voice channel and leave if requester leaves
function monitorVoiceChannel(client, guildId, voiceChannelId, userId) {
  const checkInterval = setInterval(() => {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      clearInterval(checkInterval);
      return;
    }

    const voiceChannel = guild.channels.cache.get(voiceChannelId);
    if (!voiceChannel) {
      clearInterval(checkInterval);
      musicPlayer.cleanup(guildId);
      return;
    }

    // Check if the user who requested is still in the channel
    const member = voiceChannel.members.get(userId);
    if (!member) {
      // User left, stop music and leave
      musicPlayer.stop(guildId);
      clearInterval(checkInterval);
      return;
    }

    // Check if bot is still playing
    if (!musicPlayer.isPlaying(guildId) && musicPlayer.getQueueList(guildId).length === 0) {
      clearInterval(checkInterval);
    }
  }, 5000); // Check every 5 seconds
}
