const { embeds } = require('../../../core/embeds');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, emojis } = require('../../../config/setup');
const { hasDiscordPermission } = require('../../../utils/permissions');
const fs = require('fs');
const path = require('path');

// Load word list
const wordListPath = path.join(__dirname, '../../../stroage/words.txt');
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
const gameSettings = new Map(); // Store game settings per guild (response time)
const activePlayers = new Map(); // Track active players per channel

module.exports = {
  name: "blacktea",
  aliases: ['bt', 'wordgame'],
  description: 'Play a word challenge game with friends',
  syntax: 'blacktea [subcommand] (parameters)',
  example: 'blacktea start',
  isGroupCommand: true,
  run: async (client, message, args) => {
    
    if (!args[0]) {
      const { runHelpCommand } = require('../../../utils/commandProcessor');
      return runHelpCommand(message, 'blacktea');
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'start': {
        const subcommandInfo = {
          description: 'Start a new blacktea word game',
          usage: '{guildprefix}blacktea start',
          aliases: [],
          example: '{guildprefix}blacktea start'
        };
        // Check if game is already running in this channel
        if (activeGames.has(message.channel.id)) {
          return embeds.warn(message, 'A blacktea game is **already running** in this channel!');
        }
        
        return startGame(client, message);
      }

      case 'end': {
        const subcommandInfo = {
          description: 'End the current blacktea game',
          usage: '{guildprefix}blacktea end',
          aliases: [],
          example: '{guildprefix}blacktea end'
        };
        if (!activeGames.has(message.channel.id)) {
          return embeds.warn(message, 'No blacktea game is **running** in this channel!');
        }

        activeGames.delete(message.channel.id);
        activePlayers.delete(message.channel.id);
        return embeds.success(message, 'Blacktea game has been **ended**!');
      }

      case 'exit':
      case 'quit': {
        const subcommandInfo = {
          description: 'Leave the current blacktea game',
          usage: '{guildprefix}blacktea exit',
          aliases: ['quit'],
          example: '{guildprefix}blacktea quit'
        };
        if (!activeGames.has(message.channel.id)) {
          return embeds.warn(message, 'No blacktea game is **running** in this channel!');
        }

        const players = activePlayers.get(message.channel.id);
        if (!players || !players.has(message.author.id)) {
          return embeds.warn(message, 'You are **not** in the current game!');
        }

        // Mark player as quit
        players.delete(message.author.id);
        return embeds.success(message, 'You have **left** the blacktea game!');
      }

      case 'time': {
        const subcommandInfo = {
          description: 'Set response time for blacktea games (5-60 seconds)',
          usage: '{guildprefix}blacktea time [seconds]',
          aliases: [],
          example: '{guildprefix}blacktea time 15'
        };
        if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Server')) {
          return;
        }

        const timeValue = parseInt(args[1]);
        if (!timeValue || isNaN(timeValue) || timeValue < 5 || timeValue > 60) {
          return embeds.warn(message, 'Please provide a valid time between **5-60 seconds**: `,blacktea time 15`');
        }

        gameSettings.set(message.guild.id, { responseTime: timeValue });
        return embeds.success(message, `Blacktea response time set to **${timeValue} seconds**!`);
      }

      default: {
        const { runHelpCommand } = require('../../../utils/commandProcessor');
        return runHelpCommand(message, 'blacktea');
      }
    }
  }
};
async function startGame(client, message) {
    // Check if game is already running in this channel
    if (activeGames.has(message.channel.id)) {
      return embeds.warn(message, 'A blacktea game is already running in this channel!');
    }

    activeGames.add(message.channel.id);

    // Get custom response time or default to 10 seconds
    const settings = gameSettings.get(message.guild.id) || { responseTime: 10 };
    const responseTime = settings.responseTime;

    try {
      // Send join message
      const joinEmbed = new EmbedBuilder()
        .setColor(colors.embed)
        .setTitle('The Black Teaword will start!')
        .setDescription(`To participate, **react** on \`✅\` \n\n\`Goal:\` You have **${responseTime} seconds** to write a word containing the group of **2-3 letters** indicated. You lose **1 HP** when the time is up.\n\n`)
        .setFooter({ text: 'Use ,blacktea quit to abandon' });

      const joinMessage = await message.channel.send({ embeds: [joinEmbed] });
      await joinMessage.react('✅');

      // Wait 30 seconds for players to join
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Collect reactions
      const reaction = joinMessage.reactions.cache.get('✅');
      const users = await reaction.users.fetch();
      const players = users.filter(user => !user.bot);

      if (players.size === 0) {
        activeGames.delete(message.channel.id);
        const cancelEmbed = new EmbedBuilder()
          .setColor(colors.embed)
          .setDescription('No one joined! Game cancelled.')
        return message.channel.send({ embeds: [cancelEmbed] });
      }

      // Start the game
      const startEmbed = new EmbedBuilder()
        .setColor(colors.embed)
        .setDescription(`**${players.size}** player(s) joined! Good luck!`)
      
      await message.channel.send({ embeds: [startEmbed] });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Game loop with point system
      const playersArray = Array.from(players.values());
      const gameId = message.channel.id + Date.now();
      usedWords.set(gameId, new Set());
      
      // Track active players for quit functionality
      const playerSet = new Set(playersArray.map(p => p.id));
      activePlayers.set(message.channel.id, playerSet);
      
      // Initialize player lives (everyone starts with 2 lives) and points
      const playerLives = new Map();
      const playerPoints = new Map();
      playersArray.forEach(player => {
        playerLives.set(player.id, 2);
        playerPoints.set(player.id, 0);
      });
      
      let currentPlayerIndex = 0;
      let roundsPlayed = 0;
      const minRounds = 10;

      while (playersArray.length > 0) {
        const currentPlayer = playersArray[currentPlayerIndex];
        
        // Check if player has quit
        if (!playerSet.has(currentPlayer.id)) {
          const quitEmbed = new EmbedBuilder()
            .setColor(colors.error)
            .setDescription(`${currentPlayer.username} **left** the game early`)
          
          await message.channel.send({ embeds: [quitEmbed] });
          
          playerLives.delete(currentPlayer.id);
          playersArray.splice(currentPlayerIndex, 1);
          
          if (currentPlayerIndex >= playersArray.length && playersArray.length > 0) {
            currentPlayerIndex = 0;
          }
          continue;
        }
        
        const letterCombo = getRandomCombo();
        const currentLives = playerLives.get(currentPlayer.id);

        // Send challenge without embed
        const challengeMsg = await message.channel.send(`${emojis.wordtea} <@${currentPlayer.id}> Your word must contain: **${letterCombo.toUpperCase()}**`);

        // Wait for response with custom time window for unlimited tries
        const filter = m => m.author.id === currentPlayer.id;
        const startTime = Date.now();
        const timeLimit = responseTime * 1000;
        let correctAnswer = false;
        let countdownStarted = false;
        const gameWords = usedWords.get(gameId);

        while (!correctAnswer && (Date.now() - startTime) < timeLimit) {
          const remainingTime = timeLimit - (Date.now() - startTime);
          
          // Add countdown reactions when 3 seconds left
          if (!countdownStarted && remainingTime <= 3000) {
            countdownStarted = true;
            (async () => {
              try {
                await challengeMsg.react('3️⃣');
                await new Promise(resolve => setTimeout(resolve, 1000));
                await challengeMsg.react('2️⃣');
                await new Promise(resolve => setTimeout(resolve, 1000));
                await challengeMsg.react('1️⃣');
              } catch (err) {
                // Ignore reaction errors
              }
            })();
          }
          
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

            const lostLifeEmbed = new EmbedBuilder()
              .setColor(colors.error)
              .setDescription(`:boom: <@${currentPlayer.id}> Time's up, you have lost **a life** with only **${newLives} ${newLives === 1 ? 'life' : 'lives'}** left.`)
            
            await message.channel.send({ embeds: [lostLifeEmbed] });

            if (newLives <= 0) {
              const eliminatedEmbed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${currentPlayer.username} has been **eliminated due** to no life`)
              
              await message.channel.send({ embeds: [eliminatedEmbed] });
              
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
            
            // Award points based on word length
            const points = userAnswer.length;
            playerPoints.set(currentPlayer.id, playerPoints.get(currentPlayer.id) + points);
            
            correctAnswer = true;
            currentPlayerIndex = (currentPlayerIndex + 1) % playersArray.length;
          }
          // Wrong answer - no reaction, let them try again
        }

        roundsPlayed++;
        
        // Check if only one player remains AND minimum rounds have been played
        if (playersArray.length === 1 && roundsPlayed >= minRounds) {
          break;
        }
        
        // If all players eliminated before min rounds, end game
        if (playersArray.length === 0) {
          break;
        }
        
        // Small delay between rounds
        if (playersArray.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      // Cleanup
      usedWords.delete(gameId);
      activePlayers.delete(message.channel.id);

      // Create leaderboard with all players sorted by points
      const allPlayers = Array.from(players.values());
      const leaderboard = allPlayers
        .map(player => ({
          user: player,
          points: playerPoints.get(player.id) || 0,
          lives: playerLives.get(player.id) || 0
        }))
        .sort((a, b) => b.points - a.points);

      // Build leaderboard message
      let leaderboardText = '**Blacktea leaderboard**\n';
      leaderboard.forEach((entry, index) => {
        let prefix = '';
        if (index === 0) {
          prefix = `${emojis.gold}`;
        } else if (index === 1) {
          prefix = `${emojis.silver}`;
        } else if (index === 2) {
          prefix = `${emojis.bronze}`;
        } else {
          prefix = `\`${index + 1}\``;
        }
        
        leaderboardText += `${prefix} ${entry.user.username} - ${entry.points} points\n`;
      });

      const winner = leaderboard[0];
      const leaderboardEmbed = new EmbedBuilder()
        .setColor(colors.embed)
        .setDescription(leaderboardText)
        .setFooter({ text: `Game ended, ${winner.user.username} is the winner` });
      
      await message.channel.send({ embeds: [leaderboardEmbed] });

    } catch (error) {
      const logger = require('../../../utils/logger');
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred during the game!');
    } finally {
      activeGames.delete(message.channel.id);
    }
}
