const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const musicPlayer = require('../../../utils/musicPlayer');
const config = require('../../../config/setup');
const { runHelpCommand } = require('../../../utils/commandProcessor');

module.exports = {
  name: "queue",
  aliases: ['q'],
  description: 'View, manage, or modify the queue',
  syntax: 'queue [remove|empty|move] [args]',
  example: 'queue\nqueue remove 2\nqueue empty\nqueue move 3 1',
  run: async(client, message, args) => {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return embeds.warn(message, 'You need to be in a **voice channel**!');
    }

    const queue = musicPlayer.getQueue(message.guild.id);
    if (!queue || !queue.current) {
      return embeds.warn(message, 'Nothing is currently **playing**!');
    }

    const subCommand = args[0]?.toLowerCase();

    // Queue remove
    if (subCommand === 'remove') {
      const index = parseInt(args[1]) - 1;
      if (isNaN(index) || index < 0) {
        return embeds.warn(message, 'Please provide a valid track number!');
      }

      const queueList = musicPlayer.getQueueList(message.guild.id);
      if (index >= queueList.length) {
        return embeds.warn(message, `Track **${index + 1}** does not exist in the queue!`);
      }

      const track = queueList[index];
      if (musicPlayer.removeTrack(message.guild.id, index)) {
        const embed = new EmbedBuilder()
          .setColor(0xFFFFFF)
          .setDescription(`${config.emojis.music} ${message.author}: Removed **${track.info.title}** from the queue`);

        return message.channel.send({ embeds: [embed] });
      } else {
        return embeds.warn(message, 'Failed to remove track from queue');
      }
    }

    // Queue empty
    if (subCommand === 'empty' || subCommand === 'clear') {
      const queueList = musicPlayer.getQueueList(message.guild.id);
      if (queueList.length === 0) {
        return embeds.warn(message, 'The queue is already **empty**!');
      }

      if (musicPlayer.clearQueue(message.guild.id)) {
        const embed = new EmbedBuilder()
          .setColor(0xFFFFFF)
          .setDescription(`${config.emojis.music} ${message.author}: Queue **cleared**`);

        return message.channel.send({ embeds: [embed] });
      } else {
        return embeds.warn(message, 'Failed to clear the queue');
      }
    }

    // Queue move
    if (subCommand === 'move') {
      const from = parseInt(args[1]) - 1;
      const to = parseInt(args[2]) - 1;

      if (isNaN(from) || isNaN(to) || from < 0 || to < 0) {
        return embeds.warn(message, 'Please provide valid track positions!\nUsage: `queue move <from> <to>`');
      }

      const queueList = musicPlayer.getQueueList(message.guild.id);
      if (from >= queueList.length || to >= queueList.length) {
        return embeds.warn(message, 'Invalid track position!');
      }

      const track = queueList[from];
      if (musicPlayer.moveTrack(message.guild.id, from, to)) {
        const embed = new EmbedBuilder()
          .setColor(0xFFFFFF)
          .setDescription(`${config.emojis.music} ${message.author}: Moved **${track.info.title}** from position **${from + 1}** to **${to + 1}**`);

        return message.channel.send({ embeds: [embed] });
      } else {
        return embeds.warn(message, 'Failed to move track');
      }
    }

    // Display queue
    const current = musicPlayer.getCurrentSong(message.guild.id);
    const queueList = musicPlayer.getQueueList(message.guild.id);

    const embed = new EmbedBuilder()
      .setColor(0xFFFFFF)
      .setTitle(`${config.emojis.music} Queue for ${message.guild.name}`)
      .setDescription(
        `**Now Playing:**\n[\`${current.info.title}\`](${current.info.uri}) by \`${current.info.author}\`\n\n` +
        (queueList.length > 0 
          ? `**Up Next:**\n${queueList.slice(0, 10).map((track, i) => 
              `\`${i + 1}.\` [\`${track.info.title}\`](${track.info.uri}) by \`${track.info.author}\``
            ).join('\n')}${queueList.length > 10 ? `\n\n*And ${queueList.length - 10} more...*` : ''}`
          : '**Queue is empty**')
      )
      .setFooter({ text: `Total tracks: ${queueList.length + 1}` });

    message.channel.send({ embeds: [embed] });
  }
};
