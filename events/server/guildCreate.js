const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'guildCreate',
  async execute(guild, client) {
    try {
      // Find a suitable channel to send the welcome message
      const channel = await findWelcomeChannel(guild);
      
      if (!channel) {
        return; // No suitable channel found
      }

      // Check if bot has permission to send messages
      if (!channel.permissionsFor(guild.members.me)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
        return;
      }

      // Create the welcome embed
      const embed = new EmbedBuilder()
        .setTitle('Getting Started with Adore')
        .setDescription('Hey! Thanks for choosing **Adore Bot**. Here are a few quick tips to help you set everything up in your server.')
        .setColor('#7985cd')
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          {
            name: '**Prefix**',
            value: 'My default prefix is `,` for this server. You can change it anytime using the `prefix set` command if you prefer something else.',
            inline: false
          },
          {
            name: '**Moderation System**',
            value: 'To access moderation commands like `jail`, `ban`, `kick`, and many more, make sure to run the `setme` command. It will automatically configure the moderation system for you.',
            inline: false
          }
        );

      // Create the button
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Server')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.gg/XzS8YZG4gU')
        );

      // Send the welcome message
      await channel.send({ embeds: [embed], components: [row] });

    } catch (error) {
      // Silent fail for guild create event
    }
  },
};

/**
 * Find a suitable channel to send the welcome message
 * Priority: channels with specific names > system channel > first available text channel
 */
async function findWelcomeChannel(guild) {
  try {
    // Priority channel names to look for
    const priorityNames = ['main', 'chat', 'general', 'txt', 'lounge'];
    
    // First, check if there's a system channel set
    if (guild.systemChannel && 
        guild.systemChannel.permissionsFor(guild.members.me)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      return guild.systemChannel;
    }

    // Look for channels with priority names
    const textChannels = guild.channels.cache.filter(
      channel => channel.isTextBased() && 
                 !channel.isThread() && 
                 !channel.isVoiceBased() &&
                 channel.permissionsFor(guild.members.me)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])
    );

    // Search for priority named channels
    for (const name of priorityNames) {
      const channel = textChannels.find(ch => 
        ch.name.toLowerCase().includes(name)
      );
      if (channel) {
        return channel;
      }
    }

    // If no priority channel found, get the first available text channel
    const firstChannel = textChannels
      .sort((a, b) => a.position - b.position)
      .first();

    return firstChannel || null;

  } catch (error) {
    return null;
  }
}
