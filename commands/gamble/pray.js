const { embeds } = require('../../core/embeds');

module.exports = {
  name: "pray",
  aliases: [],
  description: 'Pray for yourself or someone else to gain luck points',
  syntax: 'pray [user]',
  example: 'pray @user',
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

    // Generate random luck points (1-5)
    const luckPoints = Math.floor(Math.random() * 5) + 1;

    // Get display name
    const targetName = targetMember ? targetMember.displayName : targetUser.username;
    const authorName = message.member ? message.member.displayName : message.author.username;

    let resultMessage;

    if (isTargetingSelf) {
      resultMessage = `You feel very **lucky** with **${luckPoints} luck** points!`;
    } else {
      resultMessage = `You prayed for **${targetName}**, they feel very lucky with **${luckPoints} luck** points!`;
    }

    return embeds.createSuccess(message, resultMessage);
  }
};