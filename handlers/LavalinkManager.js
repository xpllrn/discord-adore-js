const { Manager } = require("erela.js");
const Spotify = require("erela.js-spotify");
const { lavalink, spotify, bot } = require("../config/setup");
const chalk = require('chalk');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class LavalinkManager {
  constructor(client) {
    this.client = client;

    const nodeOptions = {
      host: lavalink.host,
      port: parseInt(lavalink.port),
      password: lavalink.password,
      secure: lavalink.secure === 'true',
    };

    console.log(chalk.white('>> Lavalink Configuration'));
    console.log(chalk.cyan(`   [i] Host: ${nodeOptions.host}`));
    console.log(chalk.cyan(`   [i] Port: ${nodeOptions.port}`));
    console.log(chalk.cyan(`   [i] Secure: ${nodeOptions.secure}`));


    this.manager = new Manager({
      nodes: [nodeOptions],
      plugins: [
        new Spotify({
          clientID: spotify.clientId,
          clientSecret: spotify.clientSecret,
        }),
      ],
      send: (id, payload) => {
        const guild = this.client.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
      },
    })
      .on("nodeConnect", (node) =>
        console.log(chalk.green(`   [+] Lavalink node "${node.options.identifier}" connected.`))
      )
      .on("nodeError", (node, error) => {
        console.log(chalk.red(`   [!] Lavalink node "${node.options.identifier}" encountered an error.`));
        console.error(error);
      }
      )
      .on("trackStart", async (player, track) => {
        const channel = this.client.channels.cache.get(player.textChannel);
        if (!channel) return;

        if (player.panelId) {
          const panelMessage = await channel.messages.fetch(player.panelId).catch(() => null);
          if (panelMessage) {
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
                  .setLabel(player.paused ? '▶️ Play' : '⏸️ Pause')
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

            panelMessage.edit({ embeds: [embed], components: [row] });
          }
        } else {
          channel.send(`Now playing: \`${track.title}\``);
        }
      })
      .on("queueEnd", async (player) => {
        const channel = this.client.channels.cache.get(player.textChannel);
        if (channel && player.panelId) {
          const panelMessage = await channel.messages.fetch(player.panelId).catch(() => null);
          if (panelMessage) {
            panelMessage.delete().catch(() => {});
          }
        }
        player.destroy();
      });

    this.client.on("raw", (d) => this.manager.updateVoiceState(d));
  }
}

module.exports = LavalinkManager;
