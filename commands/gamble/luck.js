const { embeds } = require('../../core/embeds');
const { getService } = require('@services');

module.exports = {
  name: "luck",
  aliases: [],
  description: 'Check your or someone else\'s luck points',
  syntax: 'luck [user]',
  example: 'luck @user',
  cooldowns: 5, // 5 second cooldown
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

      // Get user service and current luck from database
      const userService = getService('user');
      const currentLuck = await userService.getLuck(targetUser.id);

      // Get display name
      const targetName = targetMember ? targetMember.displayName : targetUser.username;

      let resultMessage;
      let luckDescription;

      // Add descriptive text based on luck level
      if (currentLuck >= 50) {
        luckDescription = "extremely lucky! ✨";
      } else if (currentLuck >= 25) {
        luckDescription = "very lucky! 🍀";
      } else if (currentLuck >= 10) {
        luckDescription = "quite lucky! 😊";
      } else if (currentLuck > 0) {
        luckDescription = "slightly lucky! 🙂";
      } else if (currentLuck === 0) {
        luckDescription = "neutral 😐";
      } else if (currentLuck >= -10) {
        luckDescription = "slightly unlucky 😕";
      } else if (currentLuck >= -25) {
        luckDescription = "quite unlucky 😞";
      } else if (currentLuck >= -50) {
        luckDescription = "very unlucky 😰";
      } else {
        luckDescription = "extremely cursed! 💀";
      }

      if (isTargetingSelf) {
        resultMessage = `Your current luck: **${currentLuck}** points - You're ${luckDescription}`;
      } else {
        resultMessage = `**${targetName}**'s current luck: **${currentLuck}** points - They're ${luckDescription}`;
      }

      const embed = embeds.createSuccess(message, resultMessage);
      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error in luck command:', error);
      return embeds.deny(message, 'An error occurred while checking luck');
    }
  }
};