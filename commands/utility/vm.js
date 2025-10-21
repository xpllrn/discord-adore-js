const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const guildCache = require('../../database/cache/models/guild');

module.exports = {
  name: 'vm',
  description: 'Creates a voice channel control panel for your temporary VC.',
  usage: '{guildprefix}vm',
  async run(client, message, args) {
    const { member, guild } = message;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription('You must be in a voice channel to use this command.'),
        ],
      });
    }

    const voiceManager = await guildCache.getVoiceManager(guild.id);
    const tempChannel = voiceManager.tempChannels.find(tc => tc.channelId === voiceChannel.id);

    if (!tempChannel) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription('You can only use this command in a temporary voice channel created by the bot.'),
        ],
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('VoiceMaster Interface')
      .setDescription('Use the buttons below to control your voice channel.')
      .setColor('Blue');

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('vm_lock')
          .setLabel('Lock')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_unlock')
          .setLabel('Unlock')
          .setEmoji('🔓')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_hide')
          .setLabel('Hide')
          .setEmoji('👻')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_unhide')
          .setLabel('Unhide')
          .setEmoji('👁️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_rename')
          .setLabel('Rename')
          .setEmoji('📝')
          .setStyle(ButtonStyle.Primary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('vm_increase')
          .setLabel('Increase Limit')
          .setEmoji('➕')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_decrease')
          .setLabel('Decrease Limit')
          .setEmoji('➖')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_claim')
          .setLabel('Claim')
          .setEmoji('🎤')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_info')
          .setLabel('Info')
          .setEmoji('ℹ️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vm_delete')
          .setLabel('Delete')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger)
      );

    await message.channel.send({ embeds: [embed], components: [row1, row2] });
  },
};
