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
      const userMessageStats = await guildService.getMessageStats(message.guild.id, targetUser.id);

      // Get total count from user stats
      const totalCount = userMessageStats?.count || 0;

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(colors.embed)
        .setAuthor({
          name: `${targetUser.username}'s Messages`,
          iconURL: targetUser.displayAvatarURL({ dynamic: true })
        })
        .setDescription(`**Total Messages:** ${totalCount}`);

      return message.channel.send({ content: `<@${targetUser.id}>`, embeds: [embed] });

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
