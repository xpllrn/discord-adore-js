const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { findUser } = require('../../../handlers/finder');
const { colors } = require('../../../config/setup');

module.exports = {
  name: "message",
  aliases: ['msg'],
  description: "View message statistics for a user",
  syntax: 'message <user>',
  example: 'message @vwsn',
  run: async (client, message, args) => {
    try {
      let targetUser = message.author;
      let targetMember = message.member;

      // If user provided an argument, find the target user
      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found || !userResult.user) {
          return embeds.deny(message, userResult.error);
        }
        targetUser = userResult.user.user || userResult.user;
        targetMember = userResult.user;
      }

      // Get message and voice statistics
      const guildService = require('../../../database/services').getService('guild');
      const messageStats = await guildService.getMessageStats(message.guild.id, targetUser.id);
      const voiceStats = await guildService.getVoiceStats(message.guild.id, targetUser.id);

      // Helper function to format minutes to hours and minutes
      const formatTime = (totalMinutes) => {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h ${minutes}m`;
      };

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setAuthor({
          name: `${targetUser.username}'s Statistics`,
          iconURL: targetUser.displayAvatarURL({ dynamic: true })
        })
        .addFields(
          { 
            name: 'Messages', 
            value: `**Today:** ${messageStats.today}\n**This Week:** ${messageStats.week}\n**This Month:** ${messageStats.month}`, 
            inline: true 
          },
          { 
            name: 'Voice Time', 
            value: `**Today:** ${formatTime(voiceStats.today)}\n**This Week:** ${formatTime(voiceStats.week)}\n**This Month:** ${formatTime(voiceStats.month)}`, 
            inline: true 
          }
        )
        .setFooter({ text: `Total Messages: ${messageStats.total}` });

      return message.channel.send({
        content: `<@${targetUser.id}>`,
        embeds: [embed],
        allowedMentions: { users: [targetUser.id] }
      });

    } catch (error) {
      // Send error to webhook instead of console
      if (client?.errorLogger) {
        client.errorLogger.log(error, 'Message Stats Command', {
          command: 'msg',
          args: args.join(' ') || '',
          user: message.author,
          guild: message.guild,
          channel: message.channel
        });
      }
      return embeds.deny(message, 'An error occurred while fetching message statistics.');
    }
  }
};
