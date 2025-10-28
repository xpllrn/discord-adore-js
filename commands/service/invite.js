const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { colors, bot } = require('../../config/setup')

module.exports = {
  name: "invite",
  aliases: ['inv'],
  description: `Send an invite link of the bot`,
  syntax: 'invite',
  example: 'invite',
  run: async(client, message, args) => {

    const embed = new EmbedBuilder()

    .setColor(colors.embed)
    .setDescription(`> Contact **[iPhone](https://discord.com/users/1243888419403206660)** if you have any questions..`)

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
