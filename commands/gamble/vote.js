const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { getService } = require('@services');
const { emojis, colors } = require('../../config/setup');
const axios = require('axios');
const path = require('path');

// Ensure environment variables are loaded
if (!process.env.TOPGG_API_TOKEN) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
  } catch (error) {
    console.error('[VOTE ERROR] Failed to load .env file:', error.message);
  }
}

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
      const BOT_ID = client.user?.id || process.env.CLIENT_ID;
      const VOTE_REWARD = 10000;
      const VOTE_COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

      // Debug token loading
      console.log(`[VOTE DEBUG] Token loaded: ${TOPGG_API_TOKEN ? 'Yes' : 'No'}, Bot ID: ${BOT_ID}`);
      
      if (!TOPGG_API_TOKEN) {
        console.error('[VOTE ERROR] TOPGG_API_TOKEN not found in environment variables');
        console.error('[VOTE ERROR] Working directory:', process.cwd());
        console.error('[VOTE ERROR] Command directory:', __dirname);
        return embeds.deny(message, 'Vote system is not properly configured. Please contact an administrator.');
      }
      
      if (!BOT_ID || BOT_ID.length < 17) {
        console.error('[VOTE ERROR] Invalid Bot ID format');
        return embeds.deny(message, 'Bot ID is not properly configured. Please contact an administrator.');
      }

      // Check if this is a claim command
      if (args[0] && args[0].toLowerCase() === 'claim') {
        // Handle vote claim
        let gambling;
        try {
          gambling = await userService.getGamblingData(userId);
        } catch (error) {
          console.error('[VOTE ERROR] Failed to get gambling data:', error);
          return embeds.deny(message, 'Unable to access your account data. Please try again later.');
        }
        
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
          console.log(`[VOTE DEBUG] Checking vote status for user ${userId}`);
          
          const apiUrl = `https://top.gg/api/bots/${BOT_ID}/check?userId=${userId}`;
          const response = await axios.get(apiUrl, {
            headers: {
              'Authorization': TOPGG_API_TOKEN
            },
            timeout: 10000 // 10 second timeout
          });

          console.log(`[VOTE DEBUG] Vote check successful - voted: ${response.data.voted}`);
          hasVoted = response.data.voted === 1;
        } catch (error) {
          console.error('[VOTE ERROR] Full error object:', error);
          console.error('[VOTE ERROR] Error message:', error.message);
          console.error('[VOTE ERROR] Response status:', error.response?.status);
          console.error('[VOTE ERROR] Response data:', error.response?.data);
          console.error('[VOTE ERROR] Response headers:', error.response?.headers);
          
          if (error.response?.status === 401) {
            console.error('[VOTE ERROR] 401 Unauthorized - Check API token validity');
          }
          
          return embeds.deny(message, 'Unable to verify your vote status. Please try again later.');
        }

        if (hasVoted) {
          // User has voted! Give them the reward
          try {
            console.log(`[VOTE DEBUG] User ${userId} has voted, giving reward of ${VOTE_REWARD} coins`);
            await userService.updateWallet(userId, VOTE_REWARD);
            await userService.updateVoteTimestamp(userId);
            console.log(`[VOTE DEBUG] Successfully updated wallet and vote timestamp for user ${userId}`);

            const embed = new EmbedBuilder()
              .setColor(colors.success || '#a4ec7c')
              .setTitle('Vote Reward Claimed!')
              .setDescription(`${emojis.success} <@${userId}>: You received **${formatCurrency(VOTE_REWARD)}** coins for voting!\n\nYou can vote again in **12 hours** for another **${formatCurrency(VOTE_REWARD)}** coins!`)
              .setFooter({ text: 'Thank you for supporting us! ❤️' });

            return message.channel.send({ embeds: [embed] });
          } catch (rewardError) {
            console.error('[VOTE ERROR] Failed to give reward:', rewardError);
            return embeds.deny(message, 'You voted successfully, but there was an error giving your reward. Please contact an administrator.');
          }
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
        let gambling;
        try {
          gambling = await userService.getGamblingData(userId);
        } catch (error) {
          console.error('[VOTE ERROR] Failed to get gambling data for vote info:', error);
          return embeds.deny(message, 'Unable to access your account data. Please try again later.');
        }
        
        const totalVotes = gambling.totalVotes || 0;
        const voteUrl = `https://top.gg/bot/${BOT_ID}/vote`;
        
        console.log(`[VOTE DEBUG] Showing vote info for user ${userId}, total votes: ${totalVotes}`);

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
