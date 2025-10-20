const { Manager } = require("erela.js");
const Spotify = require("erela.js-spotify");
const { lavalink, spotify, bot } = require("../config/setup");
const chalk = require('chalk');

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
      .on("trackStart", (player, track) => {
        const channel = this.client.channels.cache.get(player.textChannel);
        if (channel) {
          channel.send(`Now playing: \`${track.title}\``);
        }
      })
      .on("queueEnd", (player) => {
        const channel = this.client.channels.cache.get(player.textChannel);
        if (channel) {
          channel.send("Queue has ended.");
        }
        player.destroy();
      });

    this.client.on("raw", (d) => this.manager.updateVoiceState(d));
  }
}

module.exports = LavalinkManager;
