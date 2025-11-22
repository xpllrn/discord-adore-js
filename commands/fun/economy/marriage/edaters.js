const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../../core/embeds');
const { getService } = require('@services');
const { colors } = require('../../../../config/setup');
const logger = require('../../../../utils/logger');

module.exports = {
  name: "edaters",
  aliases: ['couples', 'edater'],
  description: 'View all married couples in the server',
  syntax: 'edaters',
  example: 'edaters',
  run: async (client, message, args) => {
    
    try {
      const userService = getService('user');

      // Get all members in the guild with timeout
      let members;
      try {
        members = await message.guild.members.fetch({ time: 10000 });
      } catch (fetchError) {
        return embeds.deny(message, 'Failed to fetch server members. Please try again later.');
      }
      
      // Find all married members in this server
      const marriages = [];
      const processedPairs = new Set();

      for (const [memberId, member] of members) {
        // Skip if already processed as part of a pair
        if (processedPairs.has(memberId)) continue;

        const userData = await userService.get(memberId);
        const marriage = userData?.Marriage;

        if (marriage && marriage.partnerId) {
          // Check if partner is also in this server
          const partner = members.get(marriage.partnerId);
          
          if (partner) {
            // Add both to processed set to avoid duplicates
            processedPairs.add(memberId);
            processedPairs.add(marriage.partnerId);

            // Get ring info
            let ringName = 'Cheap Ring';
            if (marriage.ringId) {
              const storeService = getService('store');
              const ring = await storeService.getItemById(marriage.ringId);
              if (ring) {
                ringName = ring.name;
              }
            }

            marriages.push({
              user1: member.user,
              user2: partner.user,
              marriedAt: new Date(marriage.marriedAt),
              ringName: ringName
            });
          }
        }
      }

      if (marriages.length === 0) {
        return embeds.warn(message, 'There are **no e-couples** in this server!');
      }

      // Sort by marriage date (oldest first)
      marriages.sort((a, b) => a.marriedAt - b.marriedAt);

      // Build description
      let description = '';
      marriages.forEach((marriage, index) => {
        const timestamp = `<t:${Math.floor(marriage.marriedAt.getTime() / 1000)}:R>`;
        description += `**${index + 1}.** <@${marriage.user1.id}> married <@${marriage.user2.id}> ${timestamp}\n`;
      });

      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle(`Couples of ${message.guild.name}`)
        .setDescription(description)
        .setFooter({ text: `You currently have ${marriages.length} e-daters here${marriages.length !== 1 ? 's' : ''}` });

      return message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while fetching married couples.');
    }
  }
};
