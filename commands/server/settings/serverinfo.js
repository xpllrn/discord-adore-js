const { MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
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

      // Build buttons
      const buttons = [];
      
      buttons.push(
        new ButtonBuilder()
          .setLabel('Icon')
          .setStyle(ButtonStyle.Link)
          .setURL(guild.iconURL({ size: 1024 }) || 'https://discord.com')
          .setDisabled(!guild.icon)
      );

      buttons.push(
        new ButtonBuilder()
          .setLabel('Splash')
          .setStyle(ButtonStyle.Link)
          .setURL(guild.splashURL({ size: 1024 }) || 'https://discord.com')
          .setDisabled(!guild.splash)
      );

      buttons.push(
        new ButtonBuilder()
          .setLabel('Banner')
          .setStyle(ButtonStyle.Link)
          .setURL(guild.bannerURL({ size: 1024 }) || 'https://discord.com')
          .setDisabled(!guild.banner)
      );

      const row = new ActionRowBuilder().addComponents(buttons);

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle(guild.name)
        .setDescription(guild.description || null)
        .addFields(
          {
            name: 'Created',
            value: `<t:${createdTimestamp}:R>`
          },
          {
            name: 'Members',
            value: `Total: ${totalMembers}\nHumans: ${humans}\nBots: ${bots}`,
            inline: true
          },
          {
            name: 'Counts',
            value: `Roles: ${roleCount}\nEmojis: ${emojiCount}`,
            inline: true
          },
          {
            name: 'Boosts',
            value: `Boosts: ${boostCount} (level ${boostLevel})\nBoosters: ${boosterCount}`,
            inline: true
          }
        )
        .setFooter({
          text: `ServerID: ${guild.id} • OwnerID: ${owner.id}`
        });

      // Send with Components V2 flag and embed
      return message.channel.send({
        flags: MessageFlags.IsComponentsV2,
        embeds: [embed],
        components: [row]
      });
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'Failed to fetch server information');
    }
  }
};
