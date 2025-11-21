const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { colors, bot } = require("../../config/setup");

module.exports = {
  name: "botinfo",
  description: `Gets basic information about the bot`,
  aliases: ["bi", "info", "about"],
  syntax: 'botinfo',
  example: 'botinfo',

  getBotInfoEmbed(client) {
    const servercount = client.guilds.cache.size;
    const usercount = client.guilds.cache.map((guild) => guild.memberCount).reduce((p, c) => p + c, 0);

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setTitle(`${client.user.username}`)
      .setDescription(`Pre-release version of **${client.user.username}** discord bot by **[ren](https://discord.com/users/1439522065656053791)** \n> Currently used by **${servercount}** Guilds and **${usercount.toLocaleString()}** users`);

    // Create button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Invite me')
          .setStyle(ButtonStyle.Link)
          .setURL(bot.inviteLink)
      );

    return { embed, row };
  },

  async run(client, message, args) {
    const { embed, row } = this.getBotInfoEmbed(client);
    message.channel.send({ embeds: [embed], components: [row] });
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Gets basic information about the bot'),

  async execute(interaction) {
    const { embed, row } = this.getBotInfoEmbed(interaction.client);
    await interaction.reply({ embeds: [embed], components: [row] });
  }
}
