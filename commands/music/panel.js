const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'panel',
  description: 'Creates a music control panel',
  usage: '{guildprefix}panel',
  async run(client, message, args) {
    const player = client.lavalink.manager.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription('There is no music currently playing.'),
        ],
      });
    }

    const track = player.queue.current;

    const embed = new EmbedBuilder()
      .setColor('Blue')
      .setTitle(track.title)
      .setURL(track.uri)
      .setAuthor({ name: 'Now Playing' })
      .setDescription(`Requested by ${track.requester}`)
      .setThumbnail(track.thumbnail)
      .addFields(
        { name: 'Author', value: track.author, inline: true },
        { name: 'Duration', value: `${new Date(track.duration).toISOString().slice(11, -5)}`, inline: true }
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('music_playpause')
          .setLabel('▶️ Pause')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('music_skip')
          .setLabel('⏭️ Skip')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('music_stop')
          .setLabel('⏹️ Stop')
          .setStyle(ButtonStyle.Danger)
      );

    const panelMessage = await message.channel.send({ embeds: [embed], components: [row] });
    player.panelId = panelMessage.id;
  },
};
