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
      // Send join message
      const joinMessage = await message.channel.send('🍵 **Blacktea Word Game** - React with ☕ to join!\n\nGame starts in **10 seconds**...');
      await joinMessage.react('☕');

      // Wait 10 seconds for players to join
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Collect reactions
      const reaction = joinMessage.reactions.cache.get('☕');
      const users = await reaction.users.fetch();
      const players = users.filter(user => !user.bot);

      if (players.size === 0) {
        activeGames.delete(message.channel.id);
        return joinMessage.edit('🍵 **Blacktea Word Game** - No one joined! Game cancelled.');
      }

      // Start the game
      await joinMessage.edit(`🍵 **Blacktea Word Game** - **${players.size}** player(s) joined!\n\nGet ready...`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Game loop with point system
      const playersArray = Array.from(players.values());
      const gameId = message.channel.id + Date.now();
      usedWords.set(gameId, new Set());
      
      // Initialize player points (everyone starts with 5 points)
      const playerPoints = new Map();
      playersArray.forEach(player => playerPoints.set(player.id, 5));
      
      let currentPlayerIndex = 0;
      let roundsPlayed = 0;

      while (playersArray.length > 0) {
        const currentPlayer = playersArray[currentPlayerIndex];
        const letterCombo = letterCombinations[Math.floor(Math.random() * letterCombinations.length)];
        const currentPoints = playerPoints.get(currentPlayer.id);

        // Show scoreboard
        const scoreboard = Array.from(playerPoints.entries())
          .map(([id, pts]) => `<@${id}>: **${pts}** ${pts === 1 ? 'point' : 'points'}`)
          .join('\n');

        // Send challenge
        await message.channel.send(`🍵 <@${currentPlayer.id}>, type a word containing **"${letterCombo}"**\n\nYou have **10 seconds**!\n\n**Scoreboard:**\n${scoreboard}`);


        // Wait for response
        const filter = m => m.author.id === currentPlayer.id;
        const collected = await message.channel.awaitMessages({ 
          filter, 
          max: 1, 
          time: 10000, 
          errors: ['time'] 
        }).catch(() => null);

        if (!collected || collected.size === 0) {
          // Player failed - timeout, lose a point
          const newPoints = currentPoints - 1;
          playerPoints.set(currentPlayer.id, newPoints);

          await message.channel.send(`${emojis.error || '❌'} <@${currentPlayer.id}> ran out of time! **-1 point** (${newPoints} remaining)`);

          if (newPoints <= 0) {
            await message.channel.send(`💀 <@${currentPlayer.id}> has been eliminated!`);
            
            playerPoints.delete(currentPlayer.id);
            playersArray.splice(currentPlayerIndex, 1);
            
            if (currentPlayerIndex >= playersArray.length && playersArray.length > 0) {
              currentPlayerIndex = 0;
            }
          } else {
            currentPlayerIndex = (currentPlayerIndex + 1) % playersArray.length;
          }
        } else {
          const userAnswer = collected.first().content.toLowerCase().trim().replace(/[^a-z]/g, '');
          const gameWords = usedWords.get(gameId);
          
          // Validate word
          const containsLetters = userAnswer.includes(letterCombo);
          const isNotUsed = !gameWords.has(userAnswer);
          const isLongEnough = userAnswer.length >= 3;
          
          // Check if valid word
          const validWord = await isValidWord(userAnswer);

          if (containsLetters && validWord && isNotUsed && isLongEnough) {
            // Correct answer - no points lost
            gameWords.add(userAnswer);
            await message.channel.send(`${emojis.success || '✅'} <@${currentPlayer.id}> got it right with **"${userAnswer}"**!`);
            currentPlayerIndex = (currentPlayerIndex + 1) % playersArray.length;
          } else {
            // Wrong answer - lose a point
            let reason = '';
            if (!isLongEnough) reason = 'word is too short (min 3 letters)';
            else if (!containsLetters) reason = `word doesn't contain "${letterCombo}"`;
            else if (!validWord) reason = 'not a valid English word';
            else if (!isNotUsed) reason = 'word already used';

            const newPoints = currentPoints - 1;
            playerPoints.set(currentPlayer.id, newPoints);

            await message.channel.send(`${emojis.error || '❌'} <@${currentPlayer.id}> **"${userAnswer}"** is invalid (${reason})! **-1 point** (${newPoints} remaining)`);

            if (newPoints <= 0) {
              await message.channel.send(`💀 <@${currentPlayer.id}> has been eliminated!`);
              
              playerPoints.delete(currentPlayer.id);
              playersArray.splice(currentPlayerIndex, 1);
              
              if (currentPlayerIndex >= playersArray.length && playersArray.length > 0) {
                currentPlayerIndex = 0;
              }
            } else {
              currentPlayerIndex = (currentPlayerIndex + 1) % playersArray.length;
            }
          }
        }

        roundsPlayed++;
        
        // Check if only one player remains
        if (playersArray.length === 1) {
          break;
        }
        
        // Small delay between rounds
        if (playersArray.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
      }
      
      // Cleanup
      usedWords.delete(gameId);

      // Game over - announce winner
      if (playersArray.length === 1) {
        const winner = playersArray[0];
        const finalPoints = playerPoints.get(winner.id);
        
        await message.channel.send(`🏆 **Blacktea Champion!**\n\n<@${winner.id}> wins with **${finalPoints}** ${finalPoints === 1 ? 'point' : 'points'} remaining! ☕`);
      } else {
        await message.channel.send('🍵 **Game Over!** - Everyone was eliminated! No winner this time.');
      }

    } catch (error) {
      console.error('Blacktea game error:', error);
      return embeds.deny(message, 'An error occurred during the game!');
    } finally {
      activeGames.delete(message.channel.id);
    }
  }
};
