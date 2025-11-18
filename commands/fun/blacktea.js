const { embeds } = require('../../core/embeds');
const fs = require('fs');
const path = require('path');

// Load word list
const wordListPath = path.join(__dirname, '../../stroage/words.txt');
const wordList = fs.readFileSync(wordListPath, 'utf-8')
  .split('\n')
  .map(w => w.trim().toLowerCase())
  .filter(w => w.length >= 3);

const wordSet = new Set(wordList);

// Function to get random letter combination from actual words
function getRandomCombo() {
  if (wordList.length === 0) return null;
  
  const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
  if (randomWord.length < 3) return getRandomCombo();
  
  const length = Math.random() < 0.5 ? 2 : 3;
  const start = Math.floor(Math.random() * (randomWord.length - length));
  
  return randomWord.substring(start, start + length);
}

// Function to validate word
function isValidWord(word) {
  return wordSet.has(word.toLowerCase());
}

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
      const joinMessage = await message.channel.send('**BlackTea Matchmaking**\n\nReact to join the game!\n\nEach player will take turns guessing words containing specific letters.\nRun out of time or make incorrect guesses, and you lose lives. The last player standing wins!');
      await joinMessage.react('✅');

      // Wait 30 seconds for players to join
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Collect reactions
      const reaction = joinMessage.reactions.cache.get('✅');
      const users = await reaction.users.fetch();
      const players = users.filter(user => !user.bot);

      if (players.size === 0) {
        activeGames.delete(message.channel.id);
        return joinMessage.edit('**BlackTea Matchmaking** - No one joined! Game cancelled.');
      }

      // Start the game
      await joinMessage.edit(`**BlackTea Match Started!**\n\n**${players.size}** player(s) joined! Good luck!`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Game loop with point system
      const playersArray = Array.from(players.values());
      const gameId = message.channel.id + Date.now();
      usedWords.set(gameId, new Set());
      
      // Initialize player lives (everyone starts with 2 lives)
      const playerLives = new Map();
      playersArray.forEach(player => playerLives.set(player.id, 2));
      
      let currentPlayerIndex = 0;
      let roundsPlayed = 0;

      while (playersArray.length > 0) {
        const currentPlayer = playersArray[currentPlayerIndex];
        const letterCombo = getRandomCombo();
        const currentLives = playerLives.get(currentPlayer.id);

        // Send challenge
        await message.channel.send(`:dart: <@${currentPlayer.id}>, your word must contain: **${letterCombo}**. You have **10 seconds** to respond!`);

        // Wait for response with 10 second window for unlimited tries
        const filter = m => m.author.id === currentPlayer.id;
        const startTime = Date.now();
        const timeLimit = 10000;
        let correctAnswer = false;
        const gameWords = usedWords.get(gameId);

        while (!correctAnswer && (Date.now() - startTime) < timeLimit) {
          const remainingTime = timeLimit - (Date.now() - startTime);
          
          const collected = await message.channel.awaitMessages({ 
            filter, 
            max: 1, 
            time: remainingTime, 
            errors: ['time'] 
          }).catch(() => null);

          if (!collected || collected.size === 0) {
            // Timeout - lose a life
            const newLives = currentLives - 1;
            playerLives.set(currentPlayer.id, newLives);

            await message.channel.send(`:boom: <@${currentPlayer.id}> lost a life (timeout). **${newLives}** ${newLives === 1 ? 'life' : 'lives'} left.`);

            if (newLives <= 0) {
              await message.channel.send(`:skull: <@${currentPlayer.id}> has been eliminated!`);
              
              playerLives.delete(currentPlayer.id);
              playersArray.splice(currentPlayerIndex, 1);
              
              if (currentPlayerIndex >= playersArray.length && playersArray.length > 0) {
                currentPlayerIndex = 0;
              }
            } else {
              currentPlayerIndex = (currentPlayerIndex + 1) % playersArray.length;
            }
            break;
          }

          const userAnswer = collected.first().content.toLowerCase().trim().replace(/[^a-z]/g, '');
          
          // Validate word
          const containsLetters = userAnswer.includes(letterCombo);
          const isNotUsed = !gameWords.has(userAnswer);
          const isLongEnough = userAnswer.length >= 3;
          const validWord = isValidWord(userAnswer);

          if (containsLetters && validWord && isNotUsed && isLongEnough) {
            // Correct answer!
            gameWords.add(userAnswer);
            await collected.first().react('✅');
            correctAnswer = true;
            currentPlayerIndex = (currentPlayerIndex + 1) % playersArray.length;
          }
          // Wrong answer - no reaction, let them try again
        }

        // If time ran out without correct answer, lose a life
        if (!correctAnswer && (Date.now() - startTime) >= timeLimit) {
          const newLives = currentLives - 1;
          playerLives.set(currentPlayer.id, newLives);

          await message.channel.send(`:boom: <@${currentPlayer.id}> lost a life (timeout). **${newLives}** ${newLives === 1 ? 'life' : 'lives'} left.`);

          if (newLives <= 0) {
            await message.channel.send(`:skull: <@${currentPlayer.id}> has been eliminated!`);
            
            playerLives.delete(currentPlayer.id);
            playersArray.splice(currentPlayerIndex, 1);
            
            if (currentPlayerIndex >= playersArray.length && playersArray.length > 0) {
              currentPlayerIndex = 0;
            }
          } else {
            currentPlayerIndex = (currentPlayerIndex + 1) % playersArray.length;
          }
        }

        roundsPlayed++;
        
        // Check if only one player remains
        if (playersArray.length === 1) {
          break;
        }
        
        // Small delay between rounds
        if (playersArray.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      // Cleanup
      usedWords.delete(gameId);

      // Game over - announce winner
      if (playersArray.length === 1) {
        const winner = playersArray[0];
        const finalLives = playerLives.get(winner.id);
        
        await message.channel.send(`:trophy: **BlackTea Champion!**\n\n<@${winner.id}> wins with **${finalLives}** ${finalLives === 1 ? 'life' : 'lives'} remaining!`);
      } else {
        await message.channel.send(':skull: **Game Over!** - Everyone was eliminated! No winner this time.');
      }

    } catch (error) {
      console.error('Blacktea game error:', error);
      return embeds.deny(message, 'An error occurred during the game!');
    } finally {
      activeGames.delete(message.channel.id);
    }
  }
};
