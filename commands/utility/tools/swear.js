const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { findUser } = require('../../../handlers/finder');
const { createPagination } = require('../../../core/buttons');
const { getService } = require('@services');
const config = require('../../../config/setup');

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
  description: `track swear usage globally across all servers`,
  isGroupCommand: true,
  run: async (client, message, args) => {
    const userService = getService('user');

    if (args[0] === 'list') {
      const subcommandInfo = {
        description: 'List all swears used by you or another user',
        syntax: '{guildprefix}swear list [user]',
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
        const userData = await userService.getUserSwearData(targetUser.id);

        if (!userData || !userData.totalSwears || userData.totalSwears === 0) {
          const username = targetMember ? targetMember.displayName : targetUser.username;
          return embeds.warn(message, `**${username}** has no recorded swears`);
        }

        const usedSwears = userData.swears.filter(swear => swear.count > 0);
        const sortedSwears = usedSwears.sort((a, b) => b.count - a.count);

        if (sortedSwears.length === 0) {
          const username = targetMember ? targetMember.displayName : targetUser.username;
          return embeds.warn(message, `**${username}** has no recorded swears`);
        }

        const calculatedTotal = userData.totalSwears;

        const formatPage = (pageSwears, currentPage, totalPages) => {
          const swearsList = pageSwears.map((swear, index) => {
            const number = ((currentPage - 1) * 10 + index + 1).toString().padStart(2, '0');
            return `\`${number}\` **${swear.word}** - ${swear.count}`;
          }).join('\n');

          const username = targetMember ? targetMember.displayName : targetUser.username;
          const isAuthor = targetUser.id === message.author.id;
          const footerText = isAuthor
            ? `You have sweared ${userData.todaySwears} times today • Total: ${calculatedTotal}`
            : `${username} has sweared ${userData.todaySwears} times today • Total: ${calculatedTotal}`;

          return new EmbedBuilder()
            .setColor(config.colors.embed)
            .setTitle(`${username}'s Swear List`)
            .setDescription(swearsList)
            .setFooter({ text: footerText });
        };

        await createPagination(message, sortedSwears, formatPage, 10, 'Swear List');
      } catch (error) {
        throw error;
      }

    } else if (args[0] === 'leaderboard' || args[0] === 'lb') {
      const subcommandInfo = {
        description: 'Show the server swear leaderboard',
        syntax: '{guildprefix}swear leaderboard',
        aliases: ['lb'],
        parameters: [],
        example: '{guildprefix}swear leaderboard'
      };

      try {
        // Get all guild members' user IDs
        await message.guild.members.fetch();
        const guildMemberIds = message.guild.members.cache.map(member => member.id);

        // Get swear data for guild members only
        const leaderboard = await userService.getSwearLeaderboardForUsers(guildMemberIds);

        if (leaderboard.length === 0) {
          return embeds.warn(message, 'No swear data found for this server');
        }

        const userPosition = leaderboard.findIndex(userData => userData.userId === message.author.id);

        // Pre-fetch all usernames to avoid async issues in pagination
        const leaderboardWithUsernames = leaderboard.map((userData, index) => {
          const userId = userData.userId;
          const member = message.guild.members.cache.get(userId);
          const username = member ? member.displayName : `User ${userId.slice(-4)}`;

          return {
            ...userData,
            userId: userId,
            username: username
          };
        });

        const formatPage = (pageUsers, currentPage, totalPages) => {
          const startIndex = (currentPage - 1) * 10;

          const leaderboardList = pageUsers.map((userData, index) => {
            const position = startIndex + index + 1;
            return `\`${position.toString().padStart(2, '0')}\` **${userData.username}** - ${userData.calculatedTotal} swears`;
          }).join('\n');

          const footerText = userPosition !== -1
            ? `Your position: #${userPosition + 1} • Page ${currentPage}/${totalPages}`
            : `Page ${currentPage}/${totalPages}`;

          return new EmbedBuilder()
            .setColor(config.colors.embed)
            .setTitle(`${message.guild.name} Swear Leaderboard`)
            .setDescription(leaderboardList)
            .setFooter({ text: footerText });
        };

        await createPagination(message, leaderboardWithUsernames, formatPage, 10, 'Swear Leaderboard');
      } catch (error) {
        throw error;
      }

    } else if (args[0]) {
      const subcommandInfo = {
        name: 'view',
        description: 'View swear statistics for a specific user',
        syntax: '{guildprefix}swear [user]',
        aliases: [],
        parameters: ['user'],
        example: '{guildprefix}swear @vwsn'
      };

      const userResult = await findUser(message.guild, args[0], client);

      if (!userResult.found) {
        return embeds.deny(message, userResult.error);
      }

      const targetUser = userResult.isGlobal ? userResult.user : userResult.user.user;
      const targetMember = userResult.isGlobal ? null : userResult.user;
      const userId = targetUser.id;

      try {
        const userData = await userService.getUserSwearData(userId);

        if (!userData || !userData.totalSwears || userData.totalSwears === 0) {
          const username = targetMember ? targetMember.displayName : targetUser.username;
          return embeds.info(message, `**${username}** has no recorded swears`);
        }

        const username = targetMember ? targetMember.displayName : targetUser.username;
        return embeds.info(message, `**${username}** has sweared **${userData.totalSwears}** times`);
      } catch (error) {
        throw error;
      }

    } else {

      try {
        const userData = await userService.getUserSwearData(message.author.id);

        if (!userData || !userData.totalSwears || userData.totalSwears === 0) {
          return embeds.info(message, 'You have no recorded swears');
        }

        return embeds.info(message, `You have sweared **${userData.totalSwears}** times`);
      } catch (error) {
        throw error;
      }
    }
  },

  // Export the detectSwears function for use in message events
  detectSwears
}
