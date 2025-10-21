const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const guildCache = require('../../database/cache/models/guild');

module.exports = {
  name: 'panel',
  description: 'Sets the voice channel hub for creating temporary VCs.',
  usage: '{guildprefix}panel <vc_id>',
  async run(client, message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('Red').setDescription('You need the `Manage Server` permission to use this command.')],
      });
    }

    const voiceChannelId = args[0];
    if (!voiceChannelId) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('Red').setDescription('Please provide the ID of the voice channel to set as the hub.')],
      });
    }

    const voiceChannel = message.guild.channels.cache.get(voiceChannelId);
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('Red').setDescription('Invalid voice channel ID provided.')],
      });
    }

    const category = voiceChannel.parent;
    if (!category) {
        return message.reply({
            embeds: [new EmbedBuilder().setColor('Red').setDescription('The selected voice channel must be in a category.')],
        });
    }

    const voiceManager = await guildCache.getVoiceManager(message.guild.id);
    voiceManager.enabled = true;
    voiceManager.joinChannelId = voiceChannel.id;
    voiceManager.categoryId = category.id;

    await guildCache.setVoiceManager(message.guild.id, voiceManager);

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('Green')
          .setDescription(`Successfully set ${voiceChannel} as the hub for creating temporary voice channels.`),
      ],
    });
  },
};
