const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { emojis } = require('../../config/setup');

module.exports = {
  name: "pray",
  aliases: [],
  description: 'Pray for yourself or someone else to gain luck points',
  syntax: 'pray [user]',
  example: 'pray @user',
  run: async (client, message, args) => {
    try {
      const userService = getService('user');
      
      // Debug logging
      console.log('UserService instance:', !!userService);
      console.log('UserService methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(userService)));
      console.log('updateLuck method exists:', typeof userService.updateLuck);

      // Get user's gambling data (creates account if doesn't exist)
      const gambling = await userService.getGamblingData(message.author.id);

      // Check pray cooldown (1 hour = 3600000 ms)
      const prayCooldown = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
      const lastPrayed = gambling.lastPrayed || null;
      const now = Date.now();

      if (lastPrayed && (now - lastPrayed) < prayCooldown) {
        const timeLeft = prayCooldown - (now - lastPrayed);
        const unixTimestamp = Math.floor((now + timeLeft) / 1000);

        const embed = new EmbedBuilder()
          .setColor('#fc6464')
          .setDescription(`${emojis.warn} <@${message.author.id}>: You can **pray** again <t:${unixTimestamp}:R>`);

        return message.channel.send({ embeds: [embed] });
      }

      // Determine target user
      let targetUser = message.author;
      let targetMember = message.member;
      let isTargetingSelf = true;

      if (message.mentions.users.first()) {
        targetUser = message.mentions.users.first();
        targetMember = message.guild.members.cache.get(targetUser.id);
        isTargetingSelf = false;
      }

      // Generate random luck gain (1-10 points)
      const luckGain = Math.floor(Math.random() * 10) + 1;

      // Update luck in database (add points)
      const newLuck = await userService.updateLuck(targetUser.id, luckGain);

      // Update pray timestamp
      await userService.updatePrayTimestamp(message.author.id);

      // Get display name
      const targetName = targetMember ? targetMember.displayName : targetUser.username;

      let resultMessage;

      if (isTargetingSelf) {
        resultMessage = `🙏 <@${message.author.id}>: You feel very **lucky**! You gained **${luckGain} luck** points! Current luck: **${newLuck}**`;
      } else {
        resultMessage = `🙏 <@${message.author.id}>: You prayed for **${targetName}**, they gained **${luckGain} luck** points! Their luck is now: **${newLuck}**`;
      }

      const embed = new EmbedBuilder()
        .setColor('#a4ec7c')
        .setDescription(resultMessage);

      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error in pray command:', error);
      return embeds.deny(message, 'An error occurred while praying');
    }
  }
};