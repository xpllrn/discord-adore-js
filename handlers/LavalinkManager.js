const { Kazagumo, Plugins, Connectors } = require('kazagumo');
const Spotify = require('kazagumo-spotify');
const { lavalink, spotify } = require('../config/setup');
const chalk = require('chalk');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class LavalinkManager {
  constructor(client) {
    this.client = client;

    const nodeOptions = {
      name: lavalink.host,
      url: `${lavalink.host}:${lavalink.port}`,
      auth: lavalink.password,
      secure: lavalink.secure === 'true',
    };

    console.log(chalk.white('>> Lavalink Configuration'));
    console.log(chalk.cyan(`   [i] Host: ${nodeOptions.url}`));
    console.log(chalk.cyan(`   [i] Secure: ${nodeOptions.secure}`));

    this.kazagumo = new Kazagumo({
      defaultSearchEngine: 'youtube',
      plugins: [
        new Plugins.PlayerMoved(this.client),
        new Spotify({
          clientId: spotify.clientId,
          clientSecret: spotify.clientSecret,
          market: 'US',
        }),
      ],
      send: (guildId, payload) => {
        const guild = this.client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
      },
    }, new Connectors.DiscordJS(this.client), [nodeOptions]);

    this.kazagumo.shoukaku.on('ready', (name) => console.log(chalk.green(`   [+] Lavalink node "${name}" connected.`)));
    this.kazagumo.shoukaku.on('error', (name, error) => {
      console.log(chalk.red(`   [!] Lavalink node "${name}" encountered an error.`));
      console.error(error);
    });

    this.kazagumo.on('playerStart', async (player, track) => {
      const channel = this.client.channels.cache.get(player.textId);
      if (!channel) return;

      if (player.panelId) {
        const panelMessage = await channel.messages.fetch(player.panelId).catch(() => null);
        if (panelMessage) {
          const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(track.title)
            .setURL(track.uri)
            .setAuthor({ name: 'Now Playing' })
            .setDescription(`Requested by ${track.requester.tag}`)
            .setThumbnail(track.thumbnail)
            .addFields(
              { name: 'Author', value: track.author, inline: true },
              { name: 'Duration', value: `${new Date(track.length).toISOString().slice(11, -5)}`, inline: true }
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
    });

    this.kazagumo.on('playerEnd', async (player) => {
        const channel = this.client.channels.cache.get(player.textId);
        if (channel && player.panelId) {
            const panelMessage = await channel.messages.fetch(player.panelId).catch(() => null);
            if (panelMessage) {
                panelMessage.delete().catch(() => {});
            }
        }
    });
  }
}

module.exports = LavalinkManager;
