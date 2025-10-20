const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'panel',
  description: 'Creates a voice channel control panel',
  usage: '{guildprefix}panel',
  async run(client, message, args) {
    if (!message.member.voice.channel) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription('You must be in a voice channel to use this command.'),
        ],
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('VoiceMaster Interface')
      .setDescription('Use the buttons below to control your voice channel.')
      .addFields({
        name: 'Button Usage',
        value:
`🔒 — Lock the voice channel
🔓 — Unlock the voice channel
👁️‍🗨️ — Ghost the voice channel
👁️ — Reveal the voice channel
🎤 — Claim the voice channel
🔗 — Disconnect a member
🎮 — Start an activity
ℹ️ — View channel information
➕ — Increase the user limit
➖ — Decrease the user limit`,
      })
      .setColor('Blue');

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('panel_lock')
          .setLabel('Lock')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('panel_unlock')
          .setLabel('Unlock')
          .setEmoji('🔓')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('panel_ghost')
          .setLabel('Ghost')
          .setEmoji('👁️‍🗨️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('panel_reveal')
          .setLabel('Reveal')
          .setEmoji('👁️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('panel_claim')
          .setLabel('Claim')
          .setEmoji('🎤')
          .setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('panel_disconnect')
          .setLabel('Disconnect')
          .setEmoji('🔗')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('panel_start_activity')
          .setLabel('Start Activity')
          .setEmoji('🎮')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('panel_info')
          .setLabel('Info')
          .setEmoji('ℹ️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('panel_increase_limit')
          .setLabel('Increase Limit')
          .setEmoji('➕')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('panel_decrease_limit')
          .setLabel('Decrease Limit')
          .setEmoji('➖')
          .setStyle(ButtonStyle.Secondary)
      );

    await message.channel.send({ embeds: [embed], components: [row1, row2] });
  },
};
