const { EmbedBuilder, PermissionsBitField } = require('discord.js');

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

      player.queue.add(res.tracks[0]);

      if (!player.playing && !player.paused) {
        player.play();
      }

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Green')
            .setDescription(`Enqueued \`${res.tracks[0].title}\`.`),
        ],
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
