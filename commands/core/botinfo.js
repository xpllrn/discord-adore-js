const { SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js');

module.exports = {
  name: "botinfo",
  description: `Gets basic information about the bot`,
  aliases: ["bi"],
  syntax: 'botinfo',
  example: 'botinfo',
  global: true,

  async run(client, message) {
    message.channel.send(':clown:');
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Gets basic information about the bot')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),

  async execute(interaction) {
    await interaction.reply(':clown:');
  }
}
