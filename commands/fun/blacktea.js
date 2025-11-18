const { EmbedBuilder } = require('discord.js');
const { embeds } = require('../../core/embeds');
const { colors, emojis } = require('../../config/setup');
const words = require('an-array-of-english-words');

// Create a Set for O(1) lookup
const wordSet = new Set(words);

// Letter combinations for challenges
const letterCombinations = [
  'ae', 'ai', 'au', 'aw', 'ay', 'ea', 'ee', 'ei', 'eo', 'eu', 'ew', 'ey',
  'ia', 'ie', 'io', 'iu', 'oa', 'oe', 'oi', 'oo', 'ou', 'ow', 'oy', 'ua',
  'ue', 'ui', 'uo', 'uy', 'bl', 'br', 'ch', 'ck', 'cl', 'cr', 'dr', 'fl',
  'fr', 'gh', 'gl', 'gr', 'kn', 'ph', 'pl', 'pr', 'qu', 'sc', 'sh', 'sk',
  'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'th', 'tr', 'tw', 'wh', 'wr', 'nd',
  'ng', 'nk', 'nt', 'pt', 'ct', 'ft', 'ld', 'lf', 'lk', 'lm', 'lp', 'lt',
  'mp', 'nc', 'rd', 'rk', 'rm', 'rn', 'rp', 'rt', 'xt'
];

const activeGames = new Set();
const usedWords = new Map(); // Track used words per game

module.exports = {
  name: "blacktea",
  aliases: ['bt', 'wordgame'],
  description: 'Play a word challenge game with friends',
  syntax: 'blacktea',
  permission: 'user',
  run: async (client, message, args) => {
    // Check if game is already running in this channel
    if (activeGames.has(message.channel.id)) {
      return embeds.warn(message, 'A blacktea game is already running in this channel!');
    }

    activeGames.add(message.channel.id);

    try {
      // Send join embed
      const joinEmbed = new EmbedBuilder()
        .setColor(colors.info || '#7985cd')
        .setTitle('🍵 Blacktea Word Game')
        .setDescription('React with ☕ to join the game!\n\nGame starts in **10 seconds**...')
        .setFooter({ text: 'Get ready to think fast!' })
        .setTimestamp();

      const joinMessage = await message.channel.send({ embeds: [joinEmbed] });
      await joinMessage.react('☕');

      // Wait 10 seconds for players to join
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Collect reactions
      const reaction = joinMessage.reactions.cache.get('☕');
      const users = await reaction.users.fetch();
      const players = users.filter(user => !user.bot);

      if (players.size === 0) {
        activeGames.delete(message.channel.id);
        return joinMessage.edit({ 
          embeds: [new EmbedBuilder()
            .setColor(colors.error || '#ff0000')
            .setTitle('🍵 Blacktea Word Game')
            .setDescription('No one joined the game! Game cancelled.')
          ]
        });
      }

      // Start the game
      const startEmbed = new EmbedBuilder()
        .setColor(colors.success || '#00ff00')
        .setTitle('🍵 Blacktea Word Game - Starting!')
        .setDescription(`**${players.size}** player(s) joined!\n\nGet ready...`)
        .setTimestamp();

      await joinMessage.edit({ embeds: [startEmbed] });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Game loop
      const playersArray = Array.from(players.values());
      const gameId = message.channel.id + Date.now();
      usedWords.set(gameId, new Set());
      
      let currentPlayerIndex = 0;
      let roundsPlayed = 0;
      const maxRounds = playersArray.length * 5; // 5 rounds per player
      let consecutiveFailures = 0;

      while (roundsPlayed < maxRounds && playersArray.length > 1) {
        const currentPlayer = playersArray[currentPlayerIndex];
        const letterCombo = letterCombinations[Math.floor(Math.random() * letterCombinations.length)];

        // Send challenge
        const challengeEmbed = new EmbedBuilder()
          .setColor('#7985cd')
          .setTitle('🍵 Your Turn!')
          .setDescription(`<@${currentPlayer.id}>, type a word containing **"${letterCombo}"**\n\nYou have **10 seconds**!\n\n*Word must be valid English and not used before*`)
          .setFooter({ text: `Round ${roundsPlayed + 1} | ${playersArray.length} players remaining` })
          .setTimestamp();

        await message.channel.send({ embeds: [challengeEmbed] });

        // Wait for response
        const filter = m => m.author.id === currentPlayer.id;
        const collected = await message.channel.awaitMessages({ 
          filter, 
          max: 1, 
          time: 10000, 
          errors: ['time'] 
        }).catch(() => null);

        if (!collected || collected.size === 0) {
          // Player failed - timeout
          const failEmbed = new EmbedBuilder()
            .setColor(colors.error || '#ff0000')
            .setDescription(`${emojis.error || '❌'} <@${currentPlayer.id}> ran out of time! You're eliminated!`)
            .setTimestamp();

          await message.channel.send({ embeds: [failEmbed] });
          playersArray.splice(currentPlayerIndex, 1);
          consecutiveFailures++;
          
          if (currentPlayerIndex >= playersArray.length && playersArray.length > 0) {
            currentPlayerIndex = 0;
          }
        } else {
          const userAnswer = collected.first().content.toLowerCase().trim().replace(/[^a-z]/g, '');
          const gameWords = usedWords.get(gameId);
          
          // Validate word
          const containsLetters = userAnswer.includes(letterCombo);
          const isValidWord = wordSet.has(userAnswer);
          const isNotUsed = !gameWords.has(userAnswer);
          const isLongEnough = userAnswer.length >= 3;

          if (containsLetters && isValidWord && isNotUsed && isLongEnough) {
            // Correct answer
            gameWords.add(userAnswer);
            const successEmbed = new EmbedBuilder()
              .setColor(colors.success || '#00ff00')
              .setDescription(`${emojis.success || '✅'} <@${currentPlayer.id}> got it right with **"${userAnswer}"**!`)
              .setTimestamp();

            await message.channel.send({ embeds: [successEmbed] });
            currentPlayerIndex = (currentPlayerIndex + 1) % playersArray.length;
            consecutiveFailures = 0;
          } else {
            // Wrong answer - provide specific feedback
            let reason = '';
            if (!isLongEnough) reason = 'word is too short (min 3 letters)';
            else if (!containsLetters) reason = `word doesn't contain "${letterCombo}"`;
            else if (!isValidWord) reason = 'not a valid English word';
            else if (!isNotUsed) reason = 'word already used';

            const wrongEmbed = new EmbedBuilder()
              .setColor(colors.error || '#ff0000')
              .setDescription(`${emojis.error || '❌'} <@${currentPlayer.id}> **"${userAnswer}"** is invalid (${reason})! You're eliminated!`)
              .setTimestamp();

            await message.channel.send({ embeds: [wrongEmbed] });
            playersArray.splice(currentPlayerIndex, 1);
            consecutiveFailures++;
            
            if (currentPlayerIndex >= playersArray.length && playersArray.length > 0) {
              currentPlayerIndex = 0;
            }
          }
        }

        roundsPlayed++;
        
        // Break if too many consecutive failures (impossible challenge)
        if (consecutiveFailures >= 3) {
          const skipEmbed = new EmbedBuilder()
            .setColor(colors.warn || '#ffaa00')
            .setDescription('⚠️ Too many failures in a row, moving to next round...')
            .setTimestamp();
          await message.channel.send({ embeds: [skipEmbed] });
          consecutiveFailures = 0;
        }
        
        // Small delay between rounds
        if (playersArray.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
      }
      
      // Cleanup
      usedWords.delete(gameId);

      // Game over - announce winner
      if (playersArray.length === 1) {
        const winnerEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🏆 Blacktea Champion!')
          .setDescription(`<@${playersArray[0].id}> wins the game!\n\nCongratulations! ☕`)
          .setTimestamp();

        await message.channel.send({ embeds: [winnerEmbed] });
      } else if (playersArray.length > 1) {
        const tieEmbed = new EmbedBuilder()
          .setColor('#7985cd')
          .setTitle('🍵 Game Over!')
          .setDescription(`Game ended! Remaining players:\n${playersArray.map(p => `<@${p.id}>`).join(', ')}`)
          .setTimestamp();

        await message.channel.send({ embeds: [tieEmbed] });
      } else {
        const noWinnerEmbed = new EmbedBuilder()
          .setColor(colors.error || '#ff0000')
          .setTitle('🍵 Game Over!')
          .setDescription('Everyone was eliminated! No winner this time.')
          .setTimestamp();

        await message.channel.send({ embeds: [noWinnerEmbed] });
      }

    } catch (error) {
      console.error('Blacktea game error:', error);
      await message.channel.send({ 
        embeds: [new EmbedBuilder()
          .setColor(colors.error || '#ff0000')
          .setDescription(`${emojis.error || '❌'} An error occurred during the game!`)
        ]
      });
    } finally {
      activeGames.delete(message.channel.id);
    }
  }
};
