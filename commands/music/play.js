const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function formatDuration(ms) {
  if (typeof ms !== 'number' || !isFinite(ms) || ms <= 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedSeconds = seconds.toString().padStart(2, '0');
  const paddedMinutes = minutes.toString().padStart(2, '0');

  if (hours > 0) {
    const paddedHours = hours.toString().padStart(2, '0');
    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
  }
  return `${paddedMinutes}:${paddedSeconds}`;
}

module.exports = {
  name: 'play',
  aliases: ['p'],
  description: 'Plays a song in your voice channel',
  usage: '{guildprefix}play <song name or url>',
  async run(client, message, args) {
    const { channel } = message.member.voice;
    if (!channel) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription('You need to be in a voice channel to play music.'),
        ],
      });
    }

    if (!channel.permissionsFor(client.user).has(PermissionsBitField.Flags.Connect)) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription("I don't have permission to connect to your voice channel."),
        ],
      });
    }
    if (!channel.permissionsFor(client.user).has(PermissionsBitField.Flags.Speak)) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription("I don't have permission to speak in your voice channel."),
        ],
      });
    }
    const query = args.join(' ');
    if (!query) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription('Please provide a song name or URL.'),
        ],
      });
    }

    if (!client.lavalink.shoukaku.nodes.size) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription('The music service is not available right now. Please try again later.'),
        ],
      });
    }

    let player;
    try {
      player = await client.lavalink.createPlayer({
        guildId: message.guild.id,
        voiceId: channel.id,
        textId: message.channel.id,
        deaf: true,
      });
    } catch (err) {
      console.error(err);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription('An error occurred while trying to create the player.'),
        ],
      });
    }

    try {
      const res = await client.lavalink.search(query, { requester: message.author });

      if (res.type === 'EMPTY' || !res.tracks.length) {
        if (player) player.destroy();
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setDescription('No results found.'),
          ],
        });
      }

      if (res.type === 'PLAYLIST') {
        for (const track of res.tracks) player.queue.add(track);
        if (!player.playing && !player.paused) player.play();
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('Green')
              .setDescription(`Enqueued playlist \`${res.playlistName}\` with ${res.tracks.length} tracks.`),
          ],
        });
      }

      const track = res.tracks[0];
      const wasPlaying = player.playing;
      player.queue.add(track);

      if (!wasPlaying && !player.paused) {
        player.play();
      }

      const embed = new EmbedBuilder()
        .setColor('Green')
        .setDescription(`[${track.title}](${track.uri})`)
        .addFields(
          { name: 'Author', value: track.author, inline: true },
          { name: 'Duration', value: track.isStream ? '`Live`' : `\`${formatDuration(track.duration)}\``, inline: true }
        )
        .setThumbnail(track.thumbnail)
        .setTimestamp()
        .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('music_playpause')
            .setLabel('⏯️')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('music_skip')
            .setLabel('⏭️')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('music_stop')
            .setLabel('⏹️')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('music_volume_down')
            .setLabel('🔉')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('music_volume_up')
            .setLabel('🔊')
            .setStyle(ButtonStyle.Secondary)
        );

      if (!wasPlaying) {
          embed.setTitle('Now Playing');
      } else {
          embed.setTitle('Enqueued Song');
          embed.addFields({ name: 'Position in queue', value: `\`${player.queue.size}\``, inline: true });
      }

      return message.reply({
        embeds: [embed],
        components: [row],
      });

    } catch (err) {
      if (player) player.destroy();
      console.error(err);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription('An error occurred while trying to play the song.'),
        ],
      });
    }
  },
};
