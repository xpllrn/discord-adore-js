const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { findUser } = require('../../../handlers/finder');
const { colors } = require('../../../config/setup');

module.exports = {
  name: "message",
  aliases: ['msg'],
  description: "View message statistics for a user",
  usage: '{guildprefix}message [@user]',
  run: async (client, message, args) => {
    try {
      let targetUser = message.author;
      let targetMember = message.member;

      // If user provided an argument, find the target user
      if (args[0]) {
        const userResult = await findUser(message.guild, args[0], client);
        if (!userResult.found || !userResult.user) {
          return embeds.deny(message, userResult.error || 'User not found!');
        }
        targetUser = userResult.user.user || userResult.user;
        targetMember = userResult.user;
      }

      // Get message statistics from guild cache
      const { getService } = require('@services');
      const guildService = getService('guild');
      const allMessageStats = await guildService.getMessageStats(message.guild.id);

      // Filter stats for the target user
      const messageStats = allMessageStats.filter(stat => stat.userId === targetUser.id);

      // Calculate time periods
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
      const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

      // Count messages for different periods
      let todayCount = 0;
      let sevenDayCount = 0;
      let thirtyDayCount = 0;
      let totalCount = 0;

      if (messageStats && messageStats.length > 0) {
        messageStats.forEach(stat => {
          const statDate = new Date(stat.date);
          totalCount += stat.count;

          if (statDate >= today) {
            todayCount += stat.count;
          }
          if (statDate >= sevenDaysAgo) {
            sevenDayCount += stat.count;
          }
          if (statDate >= thirtyDaysAgo) {
            thirtyDayCount += stat.count;
          }
        });
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setAuthor({
          name: `${targetUser.username}'s Messages`,
          iconURL: targetUser.displayAvatarURL({ dynamic: true })
        })
        .setDescription([
          `**Today:** ${todayCount}`,
          `**Last 7 days:** ${sevenDayCount}`,
          `**Last 30 days:** ${thirtyDayCount}`,
          `**Total:** ${totalCount}`
        ].join('\n'));

      return message.channel.send({ embeds: [embed] });

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
