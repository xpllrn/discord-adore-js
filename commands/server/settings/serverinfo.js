const { EmbedBuilder, MessageFlags } = require('discord.js');
const { embeds } = require('../../../core/embeds');
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

      // Build EMBED (the correct way to format structured text)
      const embed = new EmbedBuilder()
        .setTitle(guild.name)
        .setDescription(guild.description ? guild.description : null)
        .addFields(
          {
            name: 'Created',
            value: `<t:${createdTimestamp}:R>`,
            inline: false
          },
          {
            name: 'Members',
            value: `Total: **${totalMembers}**\nHumans: **${humans}**\nBots: **${bots}**`,
            inline: true
          },
          {
            name: 'Counts',
            value: `Roles: **${roleCount}**\nEmojis: **${emojiCount}**`,
            inline: true
          },
          {
            name: 'Boosts',
            value: `Boosts: **${boostCount}** (level ${boostLevel})\nBoosters: **${boosterCount}**`,
            inline: true
          },
          {
            name: 'Verification',
            value: verificationLevel,
            inline: true
          }
        )
        .setFooter({
          text: `ServerID: ${guild.id} • OwnerID: ${owner.id}`
        })
        .setThumbnail(guild.iconURL({ size: 1024 }) || null);

      // Build BUTTONS (actual valid components)
      const buttons = [];

      buttons.push({
        type: 2,
        style: 5,
        label: 'Icon',
        url: guild.iconURL({ size: 1024 }) || 'https://discord.com',
        disabled: !guild.icon
      });

      buttons.push({
        type: 2,
        style: 5,
        label: 'Splash',
        url: guild.splashURL({ size: 1024 }) || 'https://discord.com',
        disabled: !guild.splash
      });

      buttons.push({
        type: 2,
        style: 5,
        label: 'Banner',
        url: guild.bannerURL({ size: 1024 }) || 'https://discord.com',
        disabled: !guild.banner
      });

      const actionRow = {
        type: 1,
        components: buttons
      };

      // Send result
      return message.channel.send({
        flags: MessageFlags.IsComponentsV2,
        embeds: [embed],
        components: [actionRow]
      });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'Failed to fetch server information');
    }
  }
}