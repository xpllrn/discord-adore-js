const { embeds } = require('../../core/embeds');
const { getService } = require('@services');

module.exports = {
  name: "curse",
  aliases: [],
  description: 'Curse yourself or someone else to lose luck points',
  syntax: 'curse [user]',
  example: 'curse @user',
  cooldowns: 30, // 30 second cooldown
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

      // Generate random luck loss (1-5 points)
      const luckLoss = Math.floor(Math.random() * 5) + 1;

      // Get user service and update luck in database (subtract points)
      const userService = getService('user');
      const newLuck = await userService.updateLuck(targetUser.id, -luckLoss);

      // Get display names
      const targetName = targetMember ? targetMember.displayName : targetUser.username;
      const authorName = message.member ? message.member.displayName : message.author.username;

      let resultMessage;

      if (isTargetingSelf) {
        resultMessage = `You cursed yourself! You lost **${luckLoss} luck** points! Current luck: **${newLuck}**`;
      } else {
        resultMessage = `**${authorName}** puts a curse on **${targetName}**! They lost **${luckLoss} luck** points! Their luck is now: **${newLuck}**`;
      }

      const embed = embeds.createSuccess(message, resultMessage);
      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error in curse command:', error);
      return embeds.deny(message, 'An error occurred while cursing');
    }
  }
};