const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { colors, bot } = require("../../config/setup");

module.exports = {
  name: "botinfo",
  description: `Gets basic information about the bot`,
  aliases: ["bi", "info", "about"],

  run: async (client, message, args) => {

    const servercount = client.guilds.cache.size
    const usercount = client.guilds.cache.map((guild) => guild.memberCount).reduce((p, c) => p + c, 0);

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setTitle(`${client.user.username}`)
      .setDescription(`Pre-release version of **${client.user.username}** discord bot by **[iPhone](https://discord.com/users/1243888419403206660)** \n> Currently used by **${servercount}** Guilds and **${usercount.toLocaleString()}** users`);

    // Create button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Invite me')
          .setStyle(ButtonStyle.Link)
          .setURL(bot.inviteLink)
      );

    // Send message with embed and button
    message.channel.send({ embeds: [embed], components: [row] });
  }
}
