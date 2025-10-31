const { embeds } = require('../../core/embeds');

module.exports = {
  name: "curse",
  aliases: [],
  description: 'Curse yourself or someone else to lose luck points',
  syntax: 'curse [user]',
  example: 'curse @user',
  run: async (client, message, args) => {
    
    // Determine target user
    let targetUser = message.author;
    let targetMember = message.member;
    let isTargetingSelf = true;

    if (message.mentions.users.first()) {
      targetUser = message.mentions.users.first();
      targetMember = message.guild.members.cache.get(targetUser.id);
      isTargetingSelf = false;
    }

    // Generate random luck points (1-3, lower than pray)
    const luckPoints = Math.floor(Math.random() * 3) + 1;

    // Get display names
    const targetName = targetMember ? targetMember.displayName : targetUser.username;
    const authorName = message.member ? message.member.displayName : message.author.username;

    let resultMessage;

    if (isTargetingSelf) {
      resultMessage = `You cursed yourself! You feel **unlucky** with only **${luckPoints} luck** points!`;
    } else {
      resultMessage = `**${authorName}** puts a curse on **${targetName}**! They feel **unlucky** with only **${luckPoints} luck** points!`;
    }

    return embeds.createSuccess(message, resultMessage);
  }
};