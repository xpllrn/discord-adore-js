const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { emojis, colors } = require('../../config/setup');
const axios = require('axios');

// Utility functions
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

module.exports = {
  name: "vote",
  aliases: ['topgg', 'upvote'],
  description: 'Vote for the bot on Top.gg and earn 5,000 coins!',
  usage: `{guildprefix}vote`,
  run: async (client, message, args) => {
    
    try {
      const userService = getService('user');
      const userId = message.author.id;

      // Top.gg configuration
      const TOPGG_API_TOKEN = process.env.TOPGG_API_TOKEN;
      const BOT_ID = client.user.id;
      const VOTE_REWARD = 5000;
      const VOTE_COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

      // Get user's gambling data
      const gambling = await userService.getGamblingData(userId);

      // Check if user has voted recently (cooldown check)
      const lastVote = gambling.lastVote ? new Date(gambling.lastVote) : null;
      const now = new Date();

      if (lastVote && (now.getTime() - lastVote.getTime()) < VOTE_COOLDOWN) {
        // Calculate when they can vote again
        const nextVote = new Date(lastVote.getTime() + VOTE_COOLDOWN);
        const unixTimestamp = Math.floor(nextVote.getTime() / 1000);

        const embed = new EmbedBuilder()
          .setColor(colors.warn || '#fbd03b')
          .setDescription(`${emojis.warn} <@${userId}>: You can vote again <t:${unixTimestamp}:R>\n\nYou'll receive **${formatCurrency(VOTE_REWARD)}** coins when you vote!`);

        return message.channel.send({ embeds: [embed] });
      }

      // Check if user has actually voted on Top.gg (if API token is configured)
      let hasVoted = false;

      if (TOPGG_API_TOKEN) {
        try {
          const response = await axios.get(
            `https://top.gg/api/bots/${BOT_ID}/check?userId=${userId}`,
            {
              headers: {
                'Authorization': TOPGG_API_TOKEN
              }
            }
          );

          hasVoted = response.data.voted === 1;
        } catch (error) {
          console.error('Error checking Top.gg vote status:', error.message);
          // If API fails, we'll just show the vote link
        }
      }

      if (hasVoted) {
        // User has voted! Give them the reward
        await userService.updateWallet(userId, VOTE_REWARD);
        await userService.setUserField(userId, 'Gambling.lastVote', now);

        const embed = new EmbedBuilder()
          .setColor(colors.success || '#a4ec7c')
          .setTitle('🎉 Thank You for Voting!')
          .setDescription(`${emojis.success} <@${userId}>: You received **${formatCurrency(VOTE_REWARD)}** coins for voting!\n\nYou can vote again in **12 hours** for another **${formatCurrency(VOTE_REWARD)}** coins!`)
          .setFooter({ text: 'Your support helps us grow! ❤️' });

        return message.channel.send({ embeds: [embed] });
      } else {
        // User hasn't voted yet, show them the vote link
        const voteUrl = `https://top.gg/bot/${BOT_ID}/vote`;

        const embed = new EmbedBuilder()
          .setColor(colors.info || '#729bb0')
          .setTitle('🗳️ Vote for Us!')
          .setDescription(`Vote for **${client.user.username}** on **Top.gg** and earn **${formatCurrency(VOTE_REWARD)}** coins!\n\n**Rewards:**\n💰 **${formatCurrency(VOTE_REWARD)}** coins per vote\n⏰ Vote every **12 hours**\n🎁 Support the bot and get rewarded!`)
          .setFooter({ text: 'After voting, run this command again to claim your reward!' });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setLabel('Vote on Top.gg')
              .setStyle(ButtonStyle.Link)
              .setURL(voteUrl)
              .setEmoji('🗳️')
          );

        return message.channel.send({ embeds: [embed], components: [row] });
      }

    } catch (error) {
      console.error('Error in vote command:', error);
      return embeds.deny(message, 'An error occurred while processing your vote');
    }
  }
};
