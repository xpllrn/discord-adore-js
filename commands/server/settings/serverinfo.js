const { ContainerBuilder, SectionBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { colors } = require('../../../config/setup');
const logger = require('../../../utils/logger');

module.exports = {
  name: 'serverinfo',
  aliases: ['si', 'guildinfo', 'server'],
  description: 'Display detailed information about the server',
  syntax: 'serverinfo',
  example: 'serverinfo',
  run: async (client, message) => {
    try {
      const guild = message.guild;

      // Fetch guild owner
      const owner = await guild.fetchOwner();

      // Calculate server age
      const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

      // Member counts
      const totalMembers = guild.memberCount;
      const humans = guild.members.cache.filter(m => !m.user.bot).size;
      const bots = guild.members.cache.filter(m => m.user.bot).size;

      // Role, channel, and emoji counts
      const roleCount = guild.roles.cache.size;
      const channelCount = guild.channels.cache.size;
      const emojiCount = guild.emojis.cache.size;
      
      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(parseInt(colors.info.replace('#', ''), 16));

      // Title and description section
      if (guild.iconURL({ size: 1024 })) {
        container.addSectionComponents((section) =>
          section
            .addTextDisplayComponents(
              (text) => text.setContent(`# ${guild.name}`),
              (text) => text.setContent(`-# ${guild.description || '*No description set*'}`)
            )
            .setThumbnailAccessory((thumbnail) =>
              thumbnail
                .setURL(guild.iconURL({ size: 1024 }))
                .setDescription(`${guild.name} icon`)
            )
        );  
      } else {
        container.addTextDisplayComponents(
          (text) => text.setContent(`-# ${guild.description || 'No description set'}`)
        );
      } 
      // Created date with owner
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents((text) =>
        text.setContent(`Created <t:${createdTimestamp}:R> by ${owner.user.username}`)
      );

      // Information section
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents(
        (text) => text.setContent(`**Information**`),
        (text) => text.setContent(`> **Total**: ${totalMembers} • **Humans**: ${humans} • **Bots**: ${bots}\n> **Roles**: ${roleCount} • **Channels**: ${channelCount} • **Emojis**: ${emojiCount}`),
      );

      // Build buttons for server assets (always show all 3, disable if not available)
      container.addSeparatorComponents((separator) => separator);
      container.addActionRowComponents((actionRow) =>
        actionRow.setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Icon')
            .setURL(guild.iconURL({ size: 1024 }) || 'https://discord.com')
            .setDisabled(!guild.icon),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Splash')
            .setURL(guild.splashURL({ size: 1024 }) || 'https://discord.com')
            .setDisabled(!guild.splash),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Banner')
            .setURL(guild.bannerURL({ size: 1024 }) || 'https://discord.com')
            .setDisabled(!guild.banner)
        )
      );

      // Footer
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents((text) =>
        text.setContent(`-# **Server ID**: ${guild.id}`)
      );

      // Send with Components V2 flag
      return message.channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

    } catch (error) {
      console.error('[SERVERINFO ERROR]', error);
      logger.webhook.error(error, message);
      throw error; // Re-throw so commandProcessor can log it
    }
  }
}