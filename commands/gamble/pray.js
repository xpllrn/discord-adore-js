const { embeds } = require('../../core/embeds');
const { UserService } = require('../../database/services');

module.exports = {
  name: "pray",
  aliases: [],
  description: 'Pray for yourself or someone else to gain luck points',
  syntax: 'pray [user]',
  example: 'pray @user',
  run: async (client, message, args) => {
    try {
      // Determine target user
      let targetUser = message.author;
      let targetMember = message.member;
      let isTargetingSelf = true;

      if (message.mentions.users.first()) {
        targetUser = message.mentions.users.first();
        targetMember = message.guild.members.cache.get(targetUser.id);
        isTargetingSelf = false;
      }

      // Generate random luck gain (1-7 points, higher than curse)
      const luckGain = Math.floor(Math.random() * 7) + 1;

      // Update luck in database (add points)
      const newLuck = await UserService.updateLuck(targetUser.id, luckGain);

      // Get display name
      const targetName = targetMember ? targetMember.displayName : targetUser.username;

      let resultMessage;

      if (isTargetingSelf) {
        resultMessage = `You feel very **lucky**! You gained **${luckGain} luck** points! Current luck: **${newLuck}**`;
      } else {
        resultMessage = `You prayed for **${targetName}**, they gained **${luckGain} luck** points! Their luck is now: **${newLuck}**`;
      }

      const embed = embeds.createSuccess(message, resultMessage);
      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error in pray command:', error);
      return embeds.deny(message, 'An error occurred while praying');
    }
  }
};