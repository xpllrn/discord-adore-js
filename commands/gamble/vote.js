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
  syntax: 'vote claim',
  run: async (client, message, args) => {

    try {
      const userService = getService('user');
      const userId = message.author.id;

      // Top.gg configuration - hardcoded to avoid env loading issues
      const TOPGG_API_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfdCI6Ijc3MTI1NTgzMTAyMTk0NDgzMiIsImlkIjoiNzcwNTY0MDIwMjk0NjMxNDI0IiwiaWF0IjoxNzYxNzE4NTE5fQ.Qd5Adqx-NhtIEldO5PsYrQat8iQvNVuqyTYXC96f1Qk';
      const BOT_ID = client.user?.id || '1431062059260575825';
      const VOTE_REWARD = 10000;
      const VOTE_COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours in milliseconds



      // Check if this is a claim command
      if (args[0] && args[0].toLowerCase() === 'claim') {
        // Handle vote claim
        let gambling;
        try {
          gambling = await userService.getGamblingData(userId);
        } catch (error) {
          return embeds.deny(message, 'Unable to access your account data. Please try again later.');
        }

        const lastVote = gambling.lastVote ? new Date(gambling.lastVote) : null;
        const now = new Date();

        // Check if user is on cooldown
        if (lastVote && (now.getTime() - lastVote.getTime()) < VOTE_COOLDOWN) {
          const nextVote = new Date(lastVote.getTime() + VOTE_COOLDOWN);
          const unixTimestamp = Math.floor(nextVote.getTime() / 1000);

          return embeds.warn(message, `You can vote again <t:${unixTimestamp}:R>\n\nYou'll receive **${formatCurrency(VOTE_REWARD)}** coins when you vote!`);
        }

        // Check if user has actually voted on Top.gg
        let hasVoted = false;

        try {
          const apiUrl = `https://top.gg/api/bots/${BOT_ID}/check?userId=${userId}`;
          const response = await axios.get(apiUrl, {
            headers: {
              'Authorization': TOPGG_API_TOKEN
            },
            timeout: 10000 // 10 second timeout
          });

          hasVoted = response.data.voted === 1;
        } catch (error) {
          return embeds.deny(message, 'Unable to verify your vote status. Please try again later.');
        }

        if (hasVoted) {
          // User has voted! Give them the reward
          try {
            await userService.updateWallet(userId, VOTE_REWARD);
            await userService.updateVoteTimestamp(userId);

            return embeds.success(message, `You received **${formatCurrency(VOTE_REWARD)}** coins for voting!\n\nYou can vote again in **12 hours** for another **${formatCurrency(VOTE_REWARD)}** coins!`);
          } catch (rewardError) {
            return embeds.deny(message, 'You voted successfully, but there was an error giving your reward. Please contact an administrator.');
          }
        } else {
          // User hasn't voted yet
          const voteUrl = `https://top.gg/bot/${BOT_ID}/vote`;

          const embed = embeds.createDeny(message, `You need to vote first before claiming your reward!\n\nClick the button below to vote on Top.gg\n\nAfter voting, use the claim command to get your reward!`);

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
          .setDescription(`**Vote for Adore and Claim Your Daily Vote Rewards**`)
          .addFields(
            { name: 'Reward', value: `\`${formatCurrency(VOTE_REWARD)}\``, inline: true },
            { name: 'Your Votes', value: `\`${totalVotes}\``, inline: true },
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
      console.error('Error in vote command:', error);
      return embeds.deny(message, 'An error occurred while processing your vote');
    }
  }
};
