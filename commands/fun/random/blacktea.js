const { embeds } = require('../../../core/embeds');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, emojis } = require('../../../config/setup');
const { hasDiscordPermission } = require('../../../utils/permissions');
const { runHelpCommand } = require('../../../utils/commandProcessor');
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
const usedWords = new Map();
const gameSettings = new Map();
const activePlayers = new Map();

module.exports = {
  name: "blacktea",
  aliases: ['bt', 'wordgame'],
  description: 'Play a word challenge game with friends',
  syntax: 'blacktea [subcommand] (parameters)',
  example: 'blacktea start',
  isGroupCommand: true,

  subcommands: {
    start: {
      name: 'start',
      aliases: [],
      description: 'Start a new blacktea word game',
      syntax: '{guildprefix}blacktea start',
      parameters: [],
      example: '{guildprefix}blacktea start',

      handler: async (client, message, args) => {
        if (activeGames.has(message.channel.id)) {
          return embeds.warn(message, 'A blacktea game is **already running** in this channel!');
        }
        
        return startGame(client, message);
      }
    },

    end: {
      name: 'end',
      aliases: ['stop'],
      description: 'End the current blacktea game',
      syntax: '{guildprefix}blacktea end',
      parameters: [],
      example: '{guildprefix}blacktea end',

      handler: async (client, message, args) => {
        if (!activeGames.has(message.channel.id)) {
          return embeds.warn(message, 'No blacktea game is **running** in this channel!');
        }

        activeGames.delete(message.channel.id);
        activePlayers.delete(message.channel.id);
        return embeds.success(message, 'Blacktea game has been **ended**!');
      }
    },

    exit: {
      name: 'exit',
      aliases: ['quit', 'leave'],
      description: 'Leave the current blacktea game',
      syntax: '{guildprefix}blacktea exit',
      parameters: [],
      example: '{guildprefix}blacktea quit',

      handler: async (client, message, args) => {
        if (!activeGames.has(message.channel.id)) {
          return embeds.warn(message, 'No blacktea game is **running** in this channel!');
        }

        const players = activePlayers.get(message.channel.id);
        if (!players || !players.has(message.author.id)) {
          return embeds.warn(message, 'You are **not** in the current game!');
        }

        players.delete(message.author.id);
        return embeds.success(message, 'You have **left** the blacktea game!');
      }
    },

    time: {
      name: 'time',
      aliases: ['timer', 'duration'],
      description: 'Set response time for blacktea games (5-60 seconds)',
      syntax: '{guildprefix}blacktea time [seconds]',
      parameters: ['seconds'],
      example: '{guildprefix}blacktea time 15',

      handler: async (client, message, args) => {
        if (!await hasDiscordPermission(message, PermissionFlagsBits.ManageGuild, 'Manage Guild')) {
          return;
        }

        const timeValue = parseInt(args[0]);
        if (!timeValue || isNaN(timeValue) || timeValue < 5 || timeValue > 60) {
          return embeds.warn(message, 'Please provide a valid time between **5-60 seconds**: `,blacktea time 15`');
        }

        gameSettings.set(message.guild.id, { responseTime: timeValue });
        return embeds.success(message, `Blacktea response time set to **${timeValue} seconds**!`);
      }
    }
  },

  run: async (client, message, args) => {
    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return runHelpCommand(message, 'blacktea');
    }

    const subcommand = Object.values(module.exports.subcommands)
      .find(s => s.name === sub || s.aliases.includes(sub));

    if (subcommand) {
      return subcommand.handler(client, message, args.slice(1));
    }

    return runHelpCommand(message, 'blacktea');
  }
};

async function startGame(client, message) {
  if (activeGames.has(message.channel.id)) {
    return embeds.warn(message, 'A blacktea game is already running in this channel!');
  }

  activeGames.add(message.channel.id);

  const settings = gameSettings.get(message.guild.id) || { responseTime: 10 };
  const responseTime = settings.responseTime;

  try {
    const joinEmbed = new EmbedBuilder()
      .setColor(colors.embed)
      .setTitle('The Black Teaword will start!')
      .setDescription(`To participate, **react** on \`✅\` \n\n\`Goal:\` You have **${responseTime} seconds** to write a word containing the group of **2-3 letters** indicated. You lose **1 HP** when the time is up.\n\n`)
      .setFooter({ text: 'Use ,blacktea quit to abandon' });

    const joinMessage = await message.channel.send({ embeds: [joinEmbed] });
    await joinMessage.react('✅');

    await new Promise(resolve => setTimeout(resolve, 30000));

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

    const startEmbed = new EmbedBuilder()
      .setColor(colors.embed)
      .setDescription(`**${players.size}** player(s) joined! Good luck!`)
    
    await message.channel.send({ embeds: [startEmbed] });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const playersArray = Array.from(players.values());
    const gameId = message.channel.id + Date.now();
    usedWords.set(gameId, new Set());
    
    const playerSet = new Set(playersArray.map(p => p.id));
    activePlayers.set(message.channel.id, playerSet);
    
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

      const challengeMsg = await message.channel.send(`${emojis.wordtea} <@${currentPlayer.id}> Your word must contain: **${letterCombo.toUpperCase()}**`);

      const filter = m => m.author.id === currentPlayer.id;
      const startTime = Date.now();
      const timeLimit = responseTime * 1000;
      let correctAnswer = false;
      let countdownStarted = false;
      const gameWords = usedWords.get(gameId);

      while (!correctAnswer && (Date.now() - startTime) < timeLimit) {
        const remainingTime = timeLimit - (Date.now() - startTime);
        
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
        
        const containsLetters = userAnswer.includes(letterCombo);
        const isNotUsed = !gameWords.has(userAnswer);
        const isLongEnough = userAnswer.length >= 3;
        const validWord = isValidWord(userAnswer);

        if (containsLetters && validWord && isNotUsed && isLongEnough) {
          gameWords.add(userAnswer);
          await collected.first().react('✅');
          
          const points = userAnswer.length;
          playerPoints.set(currentPlayer.id, playerPoints.get(currentPlayer.id) + points);
          
          correctAnswer = true;
          currentPlayerIndex = (currentPlayerIndex + 1) % playersArray.length;
        }
      }

      roundsPlayed++;
      
      if (playersArray.length === 1 && roundsPlayed >= minRounds) {
        break;
      }
      
      if (playersArray.length === 0) {
        break;
      }
      
      if (playersArray.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    usedWords.delete(gameId);
    activePlayers.delete(message.channel.id);

    const allPlayers = Array.from(players.values());
    const leaderboard = allPlayers
      .map(player => ({
        user: player,
        points: playerPoints.get(player.id) || 0,
        lives: playerLives.get(player.id) || 0
      }))
      .sort((a, b) => b.points - a.points);

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
