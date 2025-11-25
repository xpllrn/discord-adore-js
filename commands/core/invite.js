const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ApplicationIntegrationType } = require('discord.js');
const { colors, bot } = require('../../config/setup')

module.exports = {
  name: "invite",
  aliases: ['addme'],
  description: `Send an invite link of the bot`,
  syntax: 'invite',
  example: 'invite',
  global: true,
  
  run: async(client, message, args) => {
    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setDescription(`> Contact **[vee](https://discord.com/users/1243888419403206660)** if you have any questions..`)

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Invite me')
          .setStyle(ButtonStyle.Link)
          .setURL(bot.inviteLink)
      );

    message.channel.send({ embeds: [embed], components: [row] });
  },

  // SLASH COMMAND
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Send an invite link of the bot')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ]),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(colors.embed)
      .setDescription(`> Contact **[vee](https://discord.com/users/1243888419403206660)** if you have any questions..`)

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Invite me')
          .setStyle(ButtonStyle.Link)
          .setURL(bot.inviteLink)
      );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
}
