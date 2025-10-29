const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { emojis, colors } = require('../../config/setup');
const axios = require('axios');

// Utility functions
function formatCurrency(amount) {
  return Math.floor(amount).toLocaleString();
}

async function getGuildPrefix(message) {
  try {
    const { getService } = require('@services');
    const guildService = getService('guild');
    const prefix = await guildService.getPrefix(message.guild.id);
    return prefix || ',';
  } catch (error) {
    return ',';
  }
}

module.exports = {
  name: "vote",
  aliases: ['topgg', 'upvote'],
  description: 'Vote for the bot on Top.gg and earn 10,000 coins!',
  syntax: 'vote [claim]',
  example: 'vote\nvote claim',
  run: async (client, message, args) => {
    
    try {
      const userService = getService('user');
      const userId = message.author.id;

      // Top.gg configuration
      const TOPGG_API_TOKEN = process.env.TOPGG_API_TOKEN;
      const BOT_ID = client.user.id;
      const VOTE_REWARD = 10000;
      const VOTE_COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

      // Check if this is a claim command
      if (args[0] && args[0].toLowerCase() === 'claim') {
        // Handle vote claim
        const gambling = await userService.getGamblingData(userId);
        const lastVote = gambling.lastVote ? new Date(gambling.lastVote) : null;
        const now = new Date();

        // Check if user is on cooldown
        if (lastVote && (now.getTime() - lastVote.getTime()) < VOTE_COOLDOWN) {
          const nextVote = new Date(lastVote.getTime() + VOTE_COOLDOWN);
          const unixTimestamp = Math.floor(nextVote.getTime() / 1000);

          const embed = new EmbedBuilder()
            .setColor(colors.warn || '#fbd03b')
            .setDescription(`${emojis.warn} <@${userId}>: You can vote again <t:${unixTimestamp}:R>\n\nYou'll receive **${formatCurrency(VOTE_REWARD)}** coins when you vote!`);

          return message.channel.send({ embeds: [embed] });
        }

        // Check if user has actually voted on Top.gg
        let hasVoted = false;

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
          return embeds.deny(message, 'Unable to verify your vote status. Please try again later.');
        }

        if (hasVoted) {
          // User has voted! Give them the reward
          await userService.updateWallet(userId, VOTE_REWARD);
          await userService.updateVoteTimestamp(userId);

          const embed = new EmbedBuilder()
            .setColor(colors.success || '#a4ec7c')
            .setTitle('Vote Reward Claimed!')
            .setDescription(`${emojis.success} <@${userId}>: You received **${formatCurrency(VOTE_REWARD)}** coins for voting!\n\nYou can vote again in **12 hours** for another **${formatCurrency(VOTE_REWARD)}** coins!`)
            .setFooter({ text: 'Thank you for supporting us! ❤️' });

          return message.channel.send({ embeds: [embed] });
        } else {
          // User hasn't voted yet
          const voteUrl = `https://top.gg/bot/${BOT_ID}/vote`;

          const embed = new EmbedBuilder()
            .setColor(colors.deny || '#e74c3c')
            .setTitle('Vote Required')
            .setDescription(`${emojis.deny} <@${userId}>: You need to vote first before claiming your reward!\n\nClick the button below to vote on Top.gg`)
            .setFooter({ text: 'After voting, use the claim command to get your reward!' });

          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setLabel('Vote on Top.gg')
                .setStyle(ButtonStyle.Link)
                .setURL(voteUrl)
            );

          return message.channel.send({ embeds: [embed], components: [row] });
        }
      } else {
        // Handle regular vote command (show vote info)
        const gambling = await userService.getGamblingData(userId);
        const totalVotes = gambling.totalVotes || 0;
        const voteUrl = `https://top.gg/bot/${BOT_ID}/vote`;

        const embed = new EmbedBuilder()
          .setColor(colors.info || '#729bb0')
          .setTitle('Vote for Adore and Claim Your Daily Vote Rewards')
          .addFields(
            {
              name: 'Reward',
              value: `> 💸 ${formatCurrency(VOTE_REWARD)}`,
              inline: true
            },
            {
              name: 'Votes',
              value: `> ${totalVotes} (shows total votes you did till now)`,
              inline: true
            }
          )
          .setFooter({ text: `Use ${await getGuildPrefix(message)}vote claim to claim your reward` });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setLabel('Vote on Top.gg')
              .setStyle(ButtonStyle.Link)
              .setURL(voteUrl)
          );

        return message.channel.send({ embeds: [embed], components: [row] });
      }

    } catch (error) {
      console.error('Error in vote command:', error);
      return embeds.deny(message, 'An error occurred while processing your vote');
    }
  }
};
