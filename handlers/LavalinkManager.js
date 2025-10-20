const { Manager } = require("erela.js");
const Spotify = require("erela.js-spotify");
const { lavalink, spotify, bot } = require("../config/setup");

class LavalinkManager {
  constructor(client) {
    this.client = client;
    this.manager = new Manager({
      nodes: [
        {
          host: lavalink.host,
          port: parseInt(lavalink.port),
          password: lavalink.password,
          secure: lavalink.secure === 'true',
        },
      ],
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
        console.log(`Lavalink node "${node.options.identifier}" connected.`)
      )
      .on("nodeError", (node, error) =>
        console.log(
          `Lavalink node "${node.options.identifier}" encountered an error: ${error.message}.`
        )
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
