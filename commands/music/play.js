const { EmbedBuilder } = require('discord.js');
const { PermissionsBitField } = require('discord.js');

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

    if (
      !channel
        .permissionsFor(client.user)
        .has(PermissionsBitField.Flags.Connect)
    ) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription(
              "I don't have permission to connect to your voice channel."
            ),
        ],
      });
    }
    if (
      !channel
        .permissionsFor(client.user)
        .has(PermissionsBitField.Flags.Speak)
    ) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription(
              "I don't have permission to speak in your voice channel."
            ),
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

    const player =
      client.lavalink.manager.create({
        guild: message.guild.id,
        voiceChannel: channel.id,
        textChannel: message.channel.id,
        selfDeafen: true,
      });

    if (player.state !== 'CONNECTED') player.connect();

    try {
      const res = await client.lavalink.manager.search(
        query,
        message.author
      );

      if (res.loadType === 'LOAD_FAILED') {
        if (!player.queue.current) player.destroy();
        throw new Error(res.exception.message);
      }

      switch (res.loadType) {
        case 'NO_MATCHES':
          if (!player.queue.current) player.destroy();
          return message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('Red')
                .setDescription('No results found.'),
            ],
          });
        case 'TRACK_LOADED':
        case 'SEARCH_RESULT':
          player.queue.add(res.tracks[0]);

          if (!player.playing && !player.paused && !player.queue.size) {
            player.play();
          }

          return message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('Green')
                .setDescription(
                  `Enqueued \`${res.tracks[0].title}\`.`
                ),
            ],
          });
        case 'PLAYLIST_LOADED':
          player.queue.add(res.tracks);

          if (
            !player.playing &&
            !player.paused &&
            player.queue.totalSize === res.tracks.length
          ) {
            player.play();
          }

          return message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('Green')
                .setDescription(
                  `Enqueued playlist \`${res.playlist.name}\` with ${res.tracks.length} tracks.`
                ),
            ],
          });
      }
    } catch (err) {
      if (player) player.destroy();
      console.error(err);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription(
              'An error occurred while trying to play the song.'
            ),
        ],
      });
    }
  },
};
