const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { embeds } = require('../../../core/embeds');
const { colors } = require('../../../config/setup');
const { findChannel } = require('../../../handlers/finder');

module.exports = {
  name: "firstmessage",
  aliases: ['first'],
  description: `Get a link for the first message in a channel`,
  syntax: 'firstmessage (channel)',
  example: 'firstmessage #general',
  run: async(client, message, args) => {

    let targetChannel = message.channel;

    if (args[0]) {
      // Check for channel mention first
      const mentionedChannel = message.mentions.channels.first();
      if (mentionedChannel && mentionedChannel.guild.id === message.guild.id) {
        targetChannel = mentionedChannel;
      } else {
        // Use universal channel finder
        const channelResult = findChannel(message.guild, args[0]);

        if (!channelResult.found) {
          return embeds.warn(message, channelResult.error);
        }

        targetChannel = channelResult.channel;
      }
    }

    // Check if the channel is a text-based channel
    if (!targetChannel.isTextBased()) {
      return embeds.warn(message, `**${targetChannel.name}** is not a text channel`);
    }

    try {
      // Fetch the first message in the channel
      const fetchmessages = await targetChannel.messages.fetch({
        after: 1,
        limit: 1,
      });

      const firstmessage = fetchmessages.first();

      if (!firstmessage) {
        return embeds.warn(message, `**${targetChannel.name}** has no messages`);
      }

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setDescription(`Click below to jump to the **first message** by **${firstmessage.author.username}** in ${targetChannel}!`)
        .setFooter({ 
          text: `Requested by ${message.author.username}`, 
          iconURL: message.author.displayAvatarURL({ dynamic: true }) 
        });

      const button = new ButtonBuilder()
        .setLabel('Jump to First Message')
        .setStyle(ButtonStyle.Link)
        .setURL(firstmessage.url);

      const row = new ActionRowBuilder()
        .addComponents(button);

      return message.channel.send({ embeds: [embed], components: [row] });

    } catch (error) {
      return embeds.warn(message, 'An error occurred while fetching the first message.');
    }
  }
}
