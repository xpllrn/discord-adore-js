const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { embeds } = require('../../../core/embeds');
const { colors, emojis } = require('../../../config/setup');

const activeGames = new Map();

module.exports = {
  name: "rps",
  aliases: ['rockpaperscissors', 'rockpaperscissor'],
  description: 'Play rock paper scissors alone or with another player',
  syntax: 'rps [@user]',
  example: 'rps @vwsn',
  cooldown: 3000,
  
  run: async (client, message, args) => {
    // Check if there's already a game in this channel by this user
    const gameKey = `${message.channel.id}-${message.author.id}`;
    if (activeGames.has(gameKey)) {
      return embeds.warn(message, 'You already have an active game in this channel!');
    }

    let opponent = null;
    let isSolo = true;

    // Check if user mentioned someone
    if (args[0]) {
      const mention = message.mentions.users.first();
      if (mention) {
        if (mention.id === message.author.id) {
          return embeds.warn(message, 'You cannot play against yourself!');
        }
        if (mention.bot) {
          return embeds.warn(message, 'You cannot play against bots!');
        }
        opponent = mention;
        isSolo = false;
      }
    }

    // Create game embed
    const gameEmbed = new EmbedBuilder()
      .setColor(colors.base || '#808080')
      .setDescription(
        isSolo 
          ? `<@${message.author.id}>, **choose** your move`
          : `<@${message.author.id}> vs <@${opponent.id}>, **choose** your move`
      );

    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('rps_rock')
          .setLabel('Rock')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rps_paper')
          .setLabel('Paper')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rps_scissors')
          .setLabel('Scissors')
          .setStyle(ButtonStyle.Secondary)
      );

    const gameMessage = await message.channel.send({
      embeds: [gameEmbed],
      components: [row]
    });

    // Store game state
    const gameState = {
      player1: { id: message.author.id, username: message.author.username, choice: null },
      player2: opponent ? { id: opponent.id, username: opponent.username, choice: null } : null,
      isSolo,
      messageId: gameMessage.id
    };

    activeGames.set(gameKey, gameState);
    if (!isSolo) {
      activeGames.set(`${message.channel.id}-${opponent.id}`, gameState);
    }

    // Create collector
    const collector = gameMessage.createMessageComponentCollector({
      time: 60000 // 1 minute timeout
    });

    collector.on('collect', async (interaction) => {
      const choice = interaction.customId.split('_')[1];

      if (isSolo) {
        // Solo game - player vs bot
        if (interaction.user.id !== message.author.id) {
          return interaction.reply({
            embeds: [embeds.createWarn(message, 'This game is not for you!')],
            flags: MessageFlags.Ephemeral
          });
        }

        // Bot makes random choice
        const choices = ['rock', 'paper', 'scissors'];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        
        const result = determineWinner(choice, botChoice);
        
        await endGame(interaction, gameMessage, message.author.username, 'Bot', choice, botChoice, result, message.author.id, client.user.id);
        collector.stop();
        activeGames.delete(gameKey);

      } else {
        // Two player game
        if (interaction.user.id !== gameState.player1.id && interaction.user.id !== gameState.player2.id) {
          return interaction.reply({
            embeds: [embeds.createWarn(message, 'This game is not for you!')],
            flags: MessageFlags.Ephemeral
          });
        }

        // Store player choice
        if (interaction.user.id === gameState.player1.id) {
          if (gameState.player1.choice) {
            return interaction.reply({
              embeds: [embeds.createWarn(message, 'You already made your choice!')],
              flags: MessageFlags.Ephemeral
            });
          }
          gameState.player1.choice = choice;
        } else {
          if (gameState.player2.choice) {
            return interaction.reply({
              embeds: [embeds.createWarn(message, 'You already made your choice!')],
              flags: MessageFlags.Ephemeral
            });
          }
          gameState.player2.choice = choice;
        }

        // Acknowledge the choice
        await interaction.reply({
          content: `You chose **${choice}**!`,
          flags: MessageFlags.Ephemeral
        });

        // Check if both players have chosen
        if (gameState.player1.choice && gameState.player2.choice) {
          const result = determineWinner(gameState.player1.choice, gameState.player2.choice);
          
          await endGame(
            null,
            gameMessage,
            gameState.player1.username,
            gameState.player2.username,
            gameState.player1.choice,
            gameState.player2.choice,
            result,
            gameState.player1.id,
            gameState.player2.id
          );
          
          collector.stop();
          activeGames.delete(gameKey);
          activeGames.delete(`${message.channel.id}-${opponent.id}`);
        } else {
          // Update embed to show someone has chosen
          const waitingPlayerId = gameState.player1.choice ? gameState.player2.id : gameState.player1.id;
          const updatedEmbed = new EmbedBuilder()
            .setColor(colors.base || '#808080')
            .setDescription(`<@${gameState.player1.id}> vs <@${gameState.player2.id}>, waiting for <@${waitingPlayerId}> to choose`);

          await gameMessage.edit({ embeds: [updatedEmbed] });
        }
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        try {
          const timeoutEmbed = new EmbedBuilder()
            .setColor(colors.error || '#ff0000')
            .setDescription('Game timed out');

          await gameMessage.edit({
            embeds: [timeoutEmbed],
            components: []
          });

          activeGames.delete(gameKey);
          if (!isSolo && opponent) {
            activeGames.delete(`${message.channel.id}-${opponent.id}`);
          }
        } catch (error) {
          // Ignore edit errors
        }
      }
    });
  }
};

function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'draw';
  
  if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'paper' && choice2 === 'rock') ||
    (choice1 === 'scissors' && choice2 === 'paper')
  ) {
    return 'player1';
  }
  
  return 'player2';
}

function getChoiceEmoji(choice) {
  const emojis = {
    rock: '🪨',
    paper: '📄',
    scissors: '✂️'
  };
  return emojis[choice] || choice;
}

async function endGame(interaction, gameMessage, player1Name, player2Name, choice1, choice2, result, player1Id, player2Id) {
  let resultText = '';
  let resultColor = colors.base || '#808080';

  if (result === 'draw') {
    resultText = `It's a draw, both chose **${choice1}**`;
    resultColor = colors.warn || '#ffaa00';
  } else if (result === 'player1') {
    resultText = `<@${player1Id}> won **with ${choice1}** against <@${player2Id}>'s **${choice2}**`;
    resultColor = colors.success || '#00ff00';
  } else {
    resultText = `<@${player2Id}> won **with ${choice2}** against <@${player1Id}>'s **${choice1}**`;
    resultColor = colors.success || '#00ff00';
  }

  const finalEmbed = new EmbedBuilder()
    .setColor(resultColor)
    .setDescription(resultText);

  if (interaction) {
    await interaction.update({
      embeds: [finalEmbed],
      components: []
    });
  } else {
    await gameMessage.edit({
      embeds: [finalEmbed],
      components: []
    });
  }
}
