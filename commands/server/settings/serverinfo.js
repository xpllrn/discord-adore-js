const { MessageFlags } = require('discord.js');
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

      // Build Components V2 message
      const components = [];

      // Header: Created timestamp
      components.push({
        type: 10, // Text Display
        content: `Created <t:${createdTimestamp}:R>`
      });

      // Separator
      components.push({
        type: 12 // Separator
      });

      // Server name and owner section
      let serverInfoText = `**${guild.name}** by **${owner.user.tag}**`;
      if (guild.description) {
        serverInfoText += `\n> ${guild.description}`;
      }
      components.push({
        type: 10, // Text Display
        content: serverInfoText
      });

      // Separator
      components.push({
        type: 12 // Separator
      });

      // Stats section with 3 inline text displays
      components.push({
        type: 11, // Section
        components: [
          {
            type: 10, // Text Display
            content: `**Members**\nTotal: ${totalMembers}\nHumans: ${humans}\nBots: ${bots}`
          },
          {
            type: 10, // Text Display
            content: `**Counts**\nRoles: ${roleCount}/250\nEmojis: ${emojiCount}/100`
          },
          {
            type: 10, // Text Display
            content: `**Information**\nVerification: ${verificationLevel}\nBoosts: ${boostCount} (level ${boostLevel})\nBoosters: ${boosterCount}`
          }
        ]
      });

      // Separator
      components.push({
        type: 12 // Separator
      });

      // Buttons row for Icon, Splash, Banner
      const buttons = [];
      
      if (guild.icon) {
        buttons.push({
          type: 2, // Button
          style: 5, // Link
          label: 'Icon',
          url: guild.iconURL({ size: 1024 })
        });
      } else {
        buttons.push({
          type: 2, // Button
          style: 5, // Link
          label: 'Icon',
          url: 'https://discord.com',
          disabled: true
        });
      }

      if (guild.splash) {
        buttons.push({
          type: 2, // Button
          style: 5, // Link
          label: 'Splash',
          url: guild.splashURL({ size: 1024 })
        });
      } else {
        buttons.push({
          type: 2, // Button
          style: 5, // Link
          label: 'Splash',
          url: 'https://discord.com',
          disabled: true
        });
      }

      if (guild.banner) {
        buttons.push({
          type: 2, // Button
          style: 5, // Link
          label: 'Banner',
          url: guild.bannerURL({ size: 1024 })
        });
      } else {
        buttons.push({
          type: 2, // Button
          style: 5, // Link
          label: 'Banner',
          url: 'https://discord.com',
          disabled: true
        });
      }

      components.push({
        type: 1, // Action Row
        components: buttons
      });

      // Separator
      components.push({
        type: 12 // Separator
      });

      // Footer with IDs
      components.push({
        type: 10, // Text Display
        content: `-# ServerID: ${guild.id}   OwnerID: ${owner.id}`
      });

      // Send with Components V2 flag
      return message.channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: components
      });
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'Failed to fetch server information');
    }
  }
};
