const { ContainerBuilder, SectionBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
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

      // Role and emoji counts
      const roleCount = guild.roles.cache.size;
      const emojiCount = guild.emojis.cache.size;

      // Boost information
      const boostLevel = guild.premiumTier;
      const boostCount = guild.premiumSubscriptionCount || 0;
      const boosterCount = guild.members.cache.filter(m => m.premiumSince).size;

      // Verification level mapping
      const verificationLevels = {
        0: 'None',
        1: 'Low',
        2: 'Medium',
        3: 'High',
        4: 'Very High'
      };
      const verificationLevel = verificationLevels[guild.verificationLevel] || 'Unknown';

      // Build container with display components
      const container = new ContainerBuilder()
        .setAccentColor(0x0099ff);

      // Title and description section
      if (guild.iconURL({ size: 1024 })) {
        container.addSectionComponents((section) =>
          section
            .addTextDisplayComponents(
              (text) => text.setContent(`# ${guild.name}`),
              (text) => text.setContent(guild.description || '*No description set*')
            )
            .setThumbnailAccessory((thumbnail) =>
              thumbnail
                .setURL(guild.iconURL({ size: 1024 }))
                .setDescription(`${guild.name} icon`)
            )
        );
      } else {
        container.addTextDisplayComponents(
          (text) => text.setContent(`# ${guild.name}`),
          (text) => text.setContent(guild.description || '*No description set*')
        );
      }

      // Created date
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents((text) =>
        text.setContent(`**Created:** <t:${createdTimestamp}:R>`)
      );

      // Members section
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents(
        (text) => text.setContent(`**Members**`),
        (text) => text.setContent(`Total: **${totalMembers}** • Humans: **${humans}** • Bots: **${bots}**`)
      );

      // Counts section
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents(
        (text) => text.setContent(`**Server Stats**`),
        (text) => text.setContent(`Roles: **${roleCount}** • Emojis: **${emojiCount}**`)
      );

      // Boosts section
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents(
        (text) => text.setContent(`**Boosts**`),
        (text) => text.setContent(`Level ${boostLevel} • ${boostCount} boosts from ${boosterCount} boosters`)
      );

      // Verification section
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents((text) =>
        text.setContent(`**Verification Level:** ${verificationLevel}`)
      );

      // Footer
      container.addSeparatorComponents((separator) => separator);
      container.addTextDisplayComponents((text) =>
        text.setContent(`*Server ID: ${guild.id} • Owner ID: ${owner.id}*`)
      );

      // Build buttons for server assets
      const buttons = [];

      if (guild.icon) {
        buttons.push(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Icon')
            .setURL(guild.iconURL({ size: 1024 }))
        );
      }

      if (guild.splash) {
        buttons.push(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Splash')
            .setURL(guild.splashURL({ size: 1024 }))
        );
      }

      if (guild.banner) {
        buttons.push(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Banner')
            .setURL(guild.bannerURL({ size: 1024 }))
        );
      }

      // Add buttons to container if any exist
      if (buttons.length > 0) {
        container.addActionRowComponents((actionRow) =>
          actionRow.setComponents(...buttons)
        );
      }

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