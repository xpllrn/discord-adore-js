const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embeds } = require('../../../../core/embeds');
const { getService } = require('@services');
const { emojis, colors } = require('../../../../config/setup');
const axios = require('axios');
const logger = require('../../../../utils/logger');



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
  syntax: 'vote claim',
  run: async (client, message, args) => {

    try {
      const userService = getService('user');
      const userId = message.author.id;

      // Top.gg configuration
      const TOPGG_API_TOKEN = process.env.TOPGG_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfdCI6Ijc4MDQ3MTA0MTc1NzMwNjg4MCIsImlkIjoiNzcwNTY0MDIwMjk0NjMxNDI0IiwiaWF0IjoxNzYzOTE1NTk2fQ.U0wM9atxsmZNB6YNBogXJC-NDudbAxwhSQqbQXLamjk';
      const BOT_ID = client.user?.id || '1439529198325596172';
      const VOTE_REWARD = 100000;
      const VOTE_COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours in milliseconds



      // Check if this is a claim command
      if (args[0] && args[0].toLowerCase() === 'claim') {
        // Handle vote claim
        let gambling;
        try {
          gambling = await userService.getGamblingData(userId);
        } catch (error) {
          logger.webhook.error(error, message);
          return embeds.deny(message, 'Unable to access your account data. Please try again later.');
        }

        const lastVote = gambling.lastVote ? new Date(gambling.lastVote) : null;
        const now = new Date();

        // Check if user is on cooldown FIRST (before API check)
        if (lastVote && (now.getTime() - lastVote.getTime()) < VOTE_COOLDOWN) {
          const nextVote = new Date(lastVote.getTime() + VOTE_COOLDOWN);
          const unixTimestamp = Math.floor(nextVote.getTime() / 1000);

          logger.console.log(`⏰ Vote cooldown: User ${userId} can vote <t:${unixTimestamp}:R>`);
          return embeds.warn(message, `You can vote <t:${unixTimestamp}:R>, You'll receive **${formatCurrency(VOTE_REWARD)}** coins when you vote!`);
        }

        // Check if user has actually voted on Top.gg
        let hasVoted = false;
        let apiCheckFailed = false;

        try {
          const apiUrl = `https://top.gg/api/bots/${BOT_ID}/check?userId=${userId}`;
          logger.console.log(`🔍 Checking vote status for user ${userId}...`);

          const response = await axios.get(apiUrl, {
            headers: {
              'Authorization': TOPGG_API_TOKEN
            },
            timeout: 10000 // 10 second timeout
          });

          hasVoted = response.data.voted === 1;
          logger.console.log(`✅ Top.gg API check: User ${userId} voted = ${hasVoted}`);
        } catch (error) {
          logger.webhook.error(error, message);
          apiCheckFailed = true;
          logger.console.error(`❌ Top.gg API check failed for user ${userId}:`, error.message);
          return embeds.deny(message, 'I was unable to **verify your vote** status. Please try again in a moment.');
        }

        if (hasVoted) {
          // User has voted! Update timestamp FIRST to prevent double-claiming
          try {
            await userService.updateVoteTimestamp(userId);
            await userService.updateWallet(userId, VOTE_REWARD);

            logger.console.log(`✅ Vote claimed: User ${userId} received ${VOTE_REWARD} coins`);
            return embeds.success(message, `You received **${formatCurrency(VOTE_REWARD)}** coins for voting! Come back in **12 hours** to vote again!`);
          } catch (rewardError) {
            logger.webhook.error(rewardError, message);
            return embeds.deny(message, 'You voted successfully, but there was an error giving your reward. Please contact an administrator.');
          }
        } else {
          // User hasn't voted yet OR the 12-hour Top.gg window expired
          const voteUrl = `https://top.gg/bot/${BOT_ID}/vote`;

          // Check if they voted before but the Top.gg API window expired
          const timeSinceLastVote = lastVote ? (now.getTime() - lastVote.getTime()) : null;
          const topggWindowExpired = timeSinceLastVote && timeSinceLastVote >= VOTE_COOLDOWN;

          let errorMessage = `You need to vote first before claiming your reward!\n\nClick the button below to vote on Top.gg\n\nAfter voting, use the claim command to get your reward!`;

          if (topggWindowExpired) {
            // They voted before, cooldown passed, but Top.gg API says they haven't voted
            errorMessage = `You can vote again now!\n\nClick the button below to vote on Top.gg\n\nAfter voting, use the claim command to get your reward!`;
          }

          const embed = embeds.createDeny(message, errorMessage);

          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setLabel('Vote on Top.gg')
                .setStyle(ButtonStyle.Link)
                .setURL(voteUrl)
            );

          logger.console.log(`❌ Vote claim denied: User ${userId} has not voted (or Top.gg window expired)`);
          return message.channel.send({ embeds: [embed], components: [row] });
        }
      } else {
        // Handle regular vote command (show vote info)
        let gambling;
        try {
          gambling = await userService.getGamblingData(userId);
        } catch (error) {
          return embeds.deny(message, 'Are you **suree you voted**?? ion think so!!!');
        }

        const totalVotes = gambling.totalVotes || 0;
        const voteUrl = `https://top.gg/bot/${BOT_ID}/vote`;
        const lastVote = gambling.lastVote ? new Date(gambling.lastVote) : null;
        const now = new Date();

        // Check cooldown status
        let cooldownField = { name: 'Status', value: 'Ready to vote!', inline: true };

        if (lastVote && (now.getTime() - lastVote.getTime()) < VOTE_COOLDOWN) {
          const nextVote = new Date(lastVote.getTime() + VOTE_COOLDOWN);
          const unixTimestamp = Math.floor(nextVote.getTime() / 1000);
          cooldownField = { name: 'Next Vote', value: `<t:${unixTimestamp}:R>`, inline: true };
        }

        const embed = new EmbedBuilder()
          .setColor(colors.info)
          .setDescription(`**Vote for adore and Claim Your Daily Vote Rewards**`)
          .addFields(
            { name: '**Reward**', value: `**${formatCurrency(VOTE_REWARD)}** coins`, inline: true },
            { name: '**Your Votes**', value: `**${totalVotes}** votes`, inline: true },
            cooldownField
          )
          .setFooter({ text: `Use ${await getGuildPrefix(message)}vote claim to claim your reward` });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setLabel('Vote here')
              .setStyle(ButtonStyle.Link)
              .setURL(voteUrl)
          );

        return message.channel.send({ embeds: [embed], components: [row] });
      }

    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while processing your vote');
    }
  }
};
