const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { hasDiscordPermission } = require('../../utils/permissions');
const { findUser } = require('../../handlers/finder');
const { ensureGuildData } = require('../../database');
const { createPagination, createConfirmation } = require('../../core/buttons');
const { getService } = require('@services');
const config = require('../../config/setup');

const SWEAR_WORDS = [
  // General profanity
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'cunt',
  'cock', 'motherfucker', 'fucker', 'slut', 'whore', 'hoe', 'twat', 'prick',
  'bollocks', 'wanker', 'arse', 'arsehole', 'damn', 'crap', 'hell',
  'bugger', 'piss', 'douche', 'jerkoff', 'handjob', 'rimjob', 'dildo',
  'ballsack', 'nutjob', 'tit', 'boobs', 'nipples', 'tits', 'shithead',
  'dipshit', 'asshat', 'fuckface', 'fuckhead', 'jackass', 'shitface',
  'shitass', 'cocksucker', 'dickhead', 'balllicker', 'cum', 'cumshot',
  'cumslut', 'cumdump', 'splooge', 'jizz', 'spooge', 'manwhore', 'skank',

  // Hate speech
  'nigger', 'nigga', 'chink', 'gook', 'kike', 'fag', 'faggot', 'dyke',
  'tranny', 'retard', 'tard', 'spastic', 'cripple', 'mong', 'coon',
  'sandnigger', 'raghead', 'beaner', 'wetback', 'porchmonkey', 'jungle bunny',

  // Violent
  'rape', 'rapist', 'molest', 'pedophile', 'pedo', 'incest', 'beastiality',
  'zoophile', 'necrophilia', 'childfucker', 'babyfucker',

  // Extremist
  'satanist', 'nazis', 'hitler', 'gaschamber', 'kkk', 'genocide',
  'holocaust', 'terrorist'
];

function detectSwears(text) {
  const foundSwears = [];

  // Convert to lowercase for case-insensitive detection
  const lowerText = text.toLowerCase();

  // Extract words by removing punctuation and splitting on whitespace
  const words = lowerText.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(word => word.length > 0);

  // Check each swear word against the message words
  for (const swear of SWEAR_WORDS) {
    if (words.includes(swear)) {
      foundSwears.push(swear);
    }
  }

  return foundSwears;
}

module.exports = {
  name: "swear",
  aliases: ['swears'],
  description: `track swear usage in the server`,
  isGroupCommand: true,
  run: async (client, message, args) => {
    const guildService = getService('guild');
    await ensureGuildData(message.guild.id);

    if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'List all swears used by you or another user',
        usage: '{guildprefix}swear list [user]',
        aliases: [],
        parameters: ['user (optional)'],
        example: '{guildprefix}swear list @vwsn'
      };

      let targetUser = message.author;
      let targetMember = message.member;

      if (args[1]) {
        const userResult = await findUser(message.guild, args[1], client);

        if (!userResult.found) {
          return embeds.deny(message, userResult.error);
        }

        targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
        targetMember = userResult.isGlobal ? null : userResult.user;
      }

      try {
        const userData = await guildService.getUserSwearData(message.guild.id, targetUser.id);

        if (!userData || userData.swears.length === 0) {
          const username = targetMember ? targetMember.displayName : targetUser.username;
          return embeds.warn(message, `**${username}** has no recorded swears in this server`);
        }

        const usedSwears = userData.swears.filter(swear => swear.count > 0);
        const sortedSwears = usedSwears.sort((a, b) => b.count - a.count);

        if (sortedSwears.length === 0) {
          const username = targetMember ? targetMember.displayName : targetUser.username;
          return embeds.warn(message, `**${username}** has no recorded swears in this server`);
        }

        const calculatedTotal = usedSwears.reduce((total, swear) => total + swear.count, 0);

        const formatPage = (pageSwears, currentPage, totalPages) => {
          const swearsList = pageSwears.map((swear, index) => {
            const number = ((currentPage - 1) * 10 + index + 1).toString().padStart(2, '0');
            return `\`${number}\` **${swear.word}** - ${swear.count}`;
          }).join('\n');

          const username = targetMember ? targetMember.displayName : targetUser.username;
          const isAuthor = targetUser.id === message.author.id;
          const footerText = isAuthor
            ? `You have sweared ${userData.todaySwears} times today • Total: ${calculatedTotal} • Page ${currentPage}/${totalPages}`
            : `${username} has sweared ${userData.todaySwears} times today • Total: ${calculatedTotal} • Page ${currentPage}/${totalPages}`;

          return new EmbedBuilder()
            .setColor(config.colors.embed)
            .setTitle(`${username}'s Swear List`)
            .setDescription(swearsList)
            .setFooter({ text: footerText });
        };

        await createPagination(message, sortedSwears, formatPage, 10, 'Swear List');
      } catch (error) {
        console.error('Error getting swear list:', error);
        return embeds.deny(message, 'Failed to retrieve swear list');
      }

    } else if (args[0] === 'leaderboard' || args[0] === 'lb') {
      const subcommandInfo = {
        description: 'Show the server swear leaderboard',
        usage: '{guildprefix}swear leaderboard',
        aliases: ['lb'],
        parameters: [],
        example: '{guildprefix}swear leaderboard'
      };

      try {
        const leaderboard = await guildService.getSwearLeaderboard(message.guild.id);

        if (leaderboard.length === 0) {
          return embeds.warn(message, 'No swear data found for this server');
        }

        const userPosition = await guildService.getUserSwearPosition(message.guild.id, message.author.id);

        // Pre-fetch all usernames to avoid async issues in pagination
        const leaderboardWithUsernames = await Promise.all(
          leaderboard.map(async (userData, index) => {
            let username = `User ${index + 1}`;

            // Extract userId from Mongoose document structure
            const userId = userData.userId || userData._doc?.userId || userData.toObject?.()?.userId;

            try {
              // Try to get from guild members first (most reliable)
              const member = message.guild.members.cache.get(userId);
              if (member) {
                username = member.displayName;
              } else {
                // Try to get from Discord users cache
                const cachedUser = client.users.cache.get(userId);
                if (cachedUser) {
                  username = cachedUser.username;
                } else if (userId && /^\d{17,19}$/.test(userId)) {
                  // Try to fetch from Discord API (with timeout)
                  try {
                    const fetchedUser = await Promise.race([
                      client.users.fetch(userId),
                      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                    ]);
                    if (fetchedUser) {
                      username = fetchedUser.username;
                    }
                  } catch (fetchError) {
                    // Use fallback with user ID
                    username = `User ${userId.slice(-4)}`;
                  }
                }
              }
            } catch (error) {
              // Use position-based fallback if everything fails
              username = `User ${index + 1}`;
            }

            return {
              ...userData,
              userId: userId,
              username: username
            };
          })
        );

        const formatPage = (pageUsers, currentPage, totalPages) => {
          const startIndex = (currentPage - 1) * 10;

          const leaderboardList = pageUsers.map((userData, index) => {
            const position = startIndex + index + 1;
            return `\`${position.toString().padStart(2, '0')}\` **${userData.username}** - ${userData.calculatedTotal} swears`;
          }).join('\n');

          const footerText = userPosition
            ? `Your position: #${userPosition} • Page ${currentPage}/${totalPages}`
            : `Page ${currentPage}/${totalPages}`;

          return new EmbedBuilder()
            .setColor(config.colors.embed)
            .setTitle('Swear Leaderboard')
            .setDescription(leaderboardList)
            .setFooter({ text: footerText });
        };

        await createPagination(message, leaderboardWithUsernames, formatPage, 10, 'Swear Leaderboard');
      } catch (error) {
        console.error('Error getting swear leaderboard:', error);
        return embeds.deny(message, 'Failed to retrieve swear leaderboard');
      }

    } else if (args[0] === 'reset') {
      const subcommandInfo = {
        description: 'Reset all swear data for the server',
        usage: '{guildprefix}swear reset',
        aliases: [],
        parameters: [],
        example: '{guildprefix}swear reset'
      };

      if (!hasDiscordPermission(message, PermissionFlagsBits.Administrator, 'Administrator')) return;

      try {
        const swearData = await guildService.getSwearTracker(message.guild.id);

        if (swearData.length === 0) {
          return embeds.warn(message, 'No swear data to reset');
        }

        await createConfirmation(
          message,
          'Are you sure you want to **reset all swear data** for this server?',
          async (interaction) => {

            await guildService.clearAllSwearData(message.guild.id);

            const successEmbed = embeds.createSuccess(message, 'Reset all swear data for this server');

            await interaction.editReply({ embeds: [successEmbed], components: [] });
          }
        );
      } catch (error) {
        console.error('Error resetting swear data:', error);
        return embeds.deny(message, 'Failed to reset swear data');
      }

    } else if (args[0]) {
      const userResult = await findUser(message.guild, args[0], client);

      if (!userResult.found) {
        return embeds.deny(message, userResult.error);
      }

      const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
      const targetMember = userResult.isGlobal ? null : userResult.user;
      const userId = targetUser.id;

      try {
        const userData = await guildService.getUserSwearData(message.guild.id, userId);

        if (!userData || !userData.swears || userData.swears.length === 0) {
          const username = targetMember ? targetMember.displayName : targetUser.username;
          return embeds.info(message, `**${username}** has no recorded swears in this server`);
        }

        const calculatedTotal = userData.swears.reduce((total, swear) => total + swear.count, 0);

        if (calculatedTotal === 0) {
          const username = targetMember ? targetMember.displayName : targetUser.username;
          return embeds.info(message, `**${username}** has no recorded swears in this server`);
        }

        const username = targetMember ? targetMember.displayName : targetUser.username;
        return embeds.info(message, `**${username}** has sweared **${calculatedTotal}** times`);
      } catch (error) {
        console.error('Error getting user swear data:', error);
        return embeds.deny(message, 'Failed to retrieve user swear data');
      }

    } else {

      try {
        const userData = await guildService.getUserSwearData(message.guild.id, message.author.id);

        if (!userData || !userData.swears || userData.swears.length === 0) {
          return embeds.info(message, 'You have no recorded swears in this server');
        }

        // Calculate actual total from individual word counts
        const calculatedTotal = userData.swears.reduce((total, swear) => total + swear.count, 0);

        if (calculatedTotal === 0) {
          return embeds.info(message, 'You have no recorded swears in this server');
        }

        return embeds.info(message, `You have sweared **${calculatedTotal}** times`);
      } catch (error) {
        console.error('Error getting swear data:', error);
        return embeds.deny(message, 'Failed to retrieve swear data');
      }
    }
  },

  // Export the detectSwears function for use in message events
  detectSwears
}
