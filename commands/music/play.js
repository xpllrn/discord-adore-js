module.exports = {
  name: "play",
  aliases: ['p'],
  description: "Plays music in a voice channel",
  usage: `{guildprefix}play <song>`,
  run: async (client, message, args) => {
    // Command logic will go here
    message.channel.send("This command is not yet implemented.");
  }
}