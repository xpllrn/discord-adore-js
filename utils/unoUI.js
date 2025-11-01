/**
 * UNO UI Manager
 * Handles Discord embed and button creation for UNO games
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { colors, emojis } = require('../config/setup');
const { GAME_STATUS } = require('./unoGameState');

/**
 * UNO UI Manager class
 */
class UnoUI {
  /**
   * Create lobby embed with player list
   * @param {UnoGameState} game - Game state
   * @returns {EmbedBuilder} Lobby embed
   */
  static createLobbyEmbed(game) {
    const playerList = game.players.map((player, index) => {
      const number = String(index + 1).padStart(2, '0');
      const statusIcon = player.isActive ? '' : ' 🤖';
      return `\`${number}\` **${player.username}**${statusIcon}`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
      .setColor(colors.info)
      .setTitle('🃏 Uno is about to start')
      .setDescription('**Current Players**\n' + (playerList || 'No players'))
      .addFields(
        { 
          name: 'Players', 
          value: `${game.players.length}/${game.settings.maxPlayers}`, 
          inline: true 
        },
        { 
          name: 'Host', 
          value: game.players.length > 0 ? game.players[0].username : 'Unknown', 
          inline: true 
        },
        { 
          name: 'Status', 
          value: game.players.length >= 2 ? 'Ready to start!' : 'Waiting for players...', 
          inline: true 
        }
      )
      .setThumbnail('https://cdn.discordapp.com/emojis/1434125464770838598.png') // UNO card thumbnail
      .setFooter({ 
        text: game.players.length >= 2 
          ? 'Click Play to start or wait 2 minutes for auto-start' 
          : 'Need at least 2 players to start'
      })
      .setTimestamp();
    
    return embed;
  }

  /**
   * Create lobby buttons
   * @param {UnoGameState} game - Game state
   * @returns {ActionRowBuilder} Button row
   */
  static createLobbyButtons(game) {
    const canStart = game.players.length >= 2;
    
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('uno_play')
          .setLabel('Play')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!canStart),
        new ButtonBuilder()
          .setCustomId('uno_join')
          .setLabel('Join')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(game.players.length >= game.settings.maxPlayers),
        new ButtonBuilder()
          .setCustomId('uno_settings')
          .setLabel('Settings')
          .setStyle(ButtonStyle.Secondary)
      );
  }

  /**
   * Create active game embed
   * @param {UnoGameState} game - Game state
   * @returns {EmbedBuilder} Game embed
   */
  static createGameEmbed(game) {
    const currentPlayer = game.getCurrentPlayer();
    const playerList = game.players.map((player, index) => {
      const number = String(index + 1).padStart(2, '0');
      const isCurrentPlayer = index === game.currentPlayerIndex;
      const indicator = isCurrentPlayer ? '🔘' : `\`${number}\``;
      const cardCount = player.getHandSize();
      const cardText = cardCount === 1 ? '1 card' : `${cardCount} cards`;
      const statusIcon = player.isAI ? ' 🤖' : '';
      const unoIcon = player.hasUno() && player.hasCalledUno ? ' 🔥' : '';
      
      return `${indicator} **${player.username}**${statusIcon}${unoIcon} - ${cardText}`;
    }).join('\n');
    
    const directionEmoji = game.direction > 0 ? '🔄' : '🔃';
    const directionText = game.direction > 0 ? 'Clockwise' : 'Counterclockwise';
    const currentCardDisplay = game.currentCard ? game.currentCard.getDisplayString() : 'None';
    
    let description = '';
    if (currentPlayer) {
      description = `<@${currentPlayer.userId}>, it's your turn!\n\n`;
    }
    description += `**Current Players**\n${playerList}`;
    
    // Get current card thumbnail URL
    const cardThumbnail = game.currentCard ? this.getCardImageUrl(game.currentCard) : 'https://cdn.discordapp.com/emojis/1434125464770838598.png';
    
    const embed = new EmbedBuilder()
      .setColor(colors.success)
      .setTitle('🃏 UNO Game Active')
      .setDescription(description)
      .addFields(
        { name: 'Current Card', value: currentCardDisplay, inline: true },
        { name: 'Cards in Deck', value: game.deck.getCardCount().toString(), inline: true }
      )
      .setThumbnail(cardThumbnail);
    
    // Add special effects if any
    if (game.drawCount > 0) {
      embed.addFields({ 
        name: 'Draw Penalty', 
        value: `+${game.drawCount} cards for next player`, 
        inline: true 
      });
    }
    
    if (game.wildColor) {
      embed.addFields({ 
        name: 'Wild Color', 
        value: `${this.getColorEmoji(game.wildColor)} ${game.wildColor}`, 
        inline: true 
      });
    }
    
    // Add game timer info
    const gameTime = game.startedAt ? Date.now() - game.startedAt.getTime() : 0;
    const gameTimeMinutes = Math.floor(gameTime / 60000);
    embed.setFooter({ text: `Game time: ${gameTimeMinutes}m | Use buttons below to play` });
    
    return embed;
  }

  /**
   * Create game action buttons
   * @param {UnoGameState} game - Game state
   * @param {string} userId - Current user ID
   * @returns {ActionRowBuilder[]} Array of button rows
   */
  static createGameButtons(game, userId = null) {
    const isPlayerTurn = userId && game.getCurrentPlayer()?.userId === userId;
    
    return [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('uno_cards')
            .setLabel('Cards')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('uno_choose')
            .setLabel('Choose')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!isPlayerTurn),
          new ButtonBuilder()
            .setCustomId('uno_draw')
            .setLabel('Draw')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!isPlayerTurn),
          new ButtonBuilder()
            .setCustomId('uno_uno')
            .setLabel('UNO!')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('uno_exit')
            .setLabel('Exit')
            .setStyle(ButtonStyle.Secondary)
        )
    ];
  }

  /**
   * Create player hand embed (ephemeral)
   * @param {UnoPlayer} player - Player object
   * @param {UnoGameState} game - Game state
   * @returns {EmbedBuilder} Hand embed
   */
  static createPlayerHandEmbed(player, game) {
    const handDisplay = player.hand.length > 0 
      ? player.hand.map(card => card.getDisplayString()).join(' ')
      : 'No cards';
    
    const playableCards = player.getPlayableCards(game.currentCard);
    const playableDisplay = playableCards.length > 0
      ? playableCards.map(card => card.getDisplayString()).join(' ')
      : 'None (you must draw)';
    
    const embed = new EmbedBuilder()
      .setColor(colors.info)
      .setTitle('🃏 Your Hand')
      .addFields(
        { name: 'All Cards', value: handDisplay, inline: false },
        { name: 'Playable Cards', value: playableDisplay, inline: false },
        { name: 'Current Card', value: game.currentCard?.getDisplayString() || 'None', inline: true },
        { name: 'Hand Size', value: `${player.hand.length} card(s)`, inline: true }
      )
      .setFooter({ text: 'Use the Choose button to select a card to play' });
    
    if (player.hasUno()) {
      embed.setDescription('🔥 **UNO!** You have one card left!');
    }
    
    return embed;
  }

  /**
   * Create card selection dropdown
   * @param {UnoCard[]} playableCards - Cards that can be played
   * @param {boolean} canDraw - Whether player can draw cards
   * @returns {ActionRowBuilder} Dropdown row
   */
  static createCardSelectionDropdown(playableCards, canDraw = true) {
    const options = [];
    
    // Add playable cards (limit to 24 to leave room for draw option)
    playableCards.slice(0, canDraw ? 24 : 25).forEach(card => {
      options.push({
        label: card.getCardName(),
        description: `Play this card`,
        value: card.id
      });
    });
    
    // Add draw option if no playable cards or if allowed
    if (playableCards.length === 0 || canDraw) {
      options.push({
        label: 'Draw a card',
        description: 'Draw a card from the deck',
        value: 'draw_card'
      });
    }
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('uno_card_select')
      .setPlaceholder('Choose a card to play or draw')
      .addOptions(options);
    
    return new ActionRowBuilder().addComponents(selectMenu);
  }

  /**
   * Create wild color selection dropdown
   * @returns {ActionRowBuilder} Color selection row
   */
  static createWildColorSelection() {
    const { emojis } = require('../config/setup');
    const colors = [
      { label: 'Red', value: 'red', emoji: emojis.unoRed0 || '🔴' },
      { label: 'Blue', value: 'blue', emoji: emojis.unoBlue0 || '🔵' },
      { label: 'Green', value: 'green', emoji: emojis.unoGreen0 || '🟢' },
      { label: 'Yellow', value: 'yellow', emoji: emojis.unoYellow0 || '🟡' }
    ];
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('uno_wild_color')
      .setPlaceholder('Choose a color for the wild card')
      .addOptions(colors);
    
    return new ActionRowBuilder().addComponents(selectMenu);
  }

  /**
   * Create game end embed
   * @param {UnoGameState} game - Game state
   * @param {UnoPlayer} winner - Winning player
   * @param {string} reason - End reason
   * @returns {EmbedBuilder} End game embed
   */
  static createGameEndEmbed(game, winner = null, reason = 'completed') {
    let title = '🃏 UNO Game Ended';
    let description = '';
    let color = colors.info;
    
    if (winner) {
      title = '🏆 UNO Game Complete!';
      description = `**${winner.username}** wins the game!`;
      color = colors.success;
    } else {
      switch (reason) {
        case 'timeout':
          description = 'Game ended due to timeout';
          break;
        case 'abandoned':
          description = 'Game ended due to inactivity';
          break;
        case 'manual':
          description = 'Game ended by host';
          break;
        default:
          description = 'Game ended';
      }
    }
    
    const finalScores = game.players.map((player, index) => {
      const number = String(index + 1).padStart(2, '0');
      const cardCount = player.getHandSize();
      const points = player.hand.reduce((sum, card) => sum + card.getPointValue(), 0);
      return `\`${number}\` **${player.username}** - ${cardCount} cards (${points} pts)`;
    }).join('\n');
    
    const gameTime = game.startedAt ? Date.now() - game.startedAt.getTime() : 0;
    const gameTimeText = `${Math.floor(gameTime / 60000)}m ${Math.floor((gameTime % 60000) / 1000)}s`;
    
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .addFields(
        { name: 'Final Scores', value: finalScores, inline: false },
        { name: 'Game Time', value: gameTimeText, inline: true },
        { name: 'Total Cards Played', value: game.discardPile.length.toString(), inline: true }
      )
      .setTimestamp();
    
    return embed;
  }

  /**
   * Create settings embed
   * @param {UnoGameState} game - Game state
   * @returns {EmbedBuilder} Settings embed
   */
  static createSettingsEmbed(game) {
    const embed = new EmbedBuilder()
      .setColor(colors.info)
      .setTitle('🎮 Game Settings')
      .addFields(
        { name: 'Max Players', value: game.settings.maxPlayers.toString(), inline: true },
        { name: 'Turn Time Limit', value: `${game.settings.turnTimeLimit / 1000}s`, inline: true },
        { name: 'Game Time Limit', value: `${game.settings.gameTimeLimit / 60000}m`, inline: true },
        { name: 'Allow Stacking', value: game.settings.allowStacking ? 'Yes' : 'No', inline: true },
        { name: 'Must Call UNO', value: game.settings.customRules.mustCallUno ? 'Yes' : 'No', inline: true },
        { name: 'Draw Until Playable', value: game.settings.customRules.drawUntilPlayable ? 'Yes' : 'No', inline: true }
      )
      .setFooter({ text: 'Only the host can modify settings' });
    
    return embed;
  }

  /**
   * Create confirmation embed
   * @param {string} title - Confirmation title
   * @param {string} description - Confirmation description
   * @param {string} confirmId - Confirm button custom ID
   * @param {string} cancelId - Cancel button custom ID
   * @returns {Object} Embed and components
   */
  static createConfirmationEmbed(title, description, confirmId, cancelId) {
    const embed = new EmbedBuilder()
      .setColor(colors.warn)
      .setTitle(`⚠️ ${title}`)
      .setDescription(description);
    
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(confirmId)
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(cancelId)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
    
    return { embed, components: [buttons] };
  }

  /**
   * Get color emoji for display
   * @param {string} color - Color name
   * @returns {string} Color emoji
   */
  static getColorEmoji(color) {
    const { emojis } = require('../config/setup');
    const colorEmojis = {
      red: emojis.unoRed0 || '🔴',
      blue: emojis.unoBlue0 || '🔵', 
      green: emojis.unoGreen0 || '🟢',
      yellow: emojis.unoYellow0 || '🟡',
      wild: emojis.unoInformation || '⚫'
    };
    return colorEmojis[color] || '⚪';
  }

  /**
   * Get card image URL for thumbnail
   * @param {UnoCard} card - Card object
   * @returns {string} Image URL
   */
  static getCardImageUrl(card) {
    // For now, return a generic UNO card image
    return 'https://cdn.discordapp.com/emojis/1434125464770838598.png';
  }

  /**
   * Get card type emoji
   * @param {UnoCard} card - Card object
   * @returns {string} Card type emoji
   */
  static getCardTypeEmoji(card) {
    if (card.type === 'number') {
      return '🔢';
    } else if (card.type === 'action') {
      switch (card.effect) {
        case 'skip': return '🚫';
        case 'reverse': return '🔄';
        case 'draw2': return '➕';
        default: return '⚡';
      }
    } else if (card.type === 'wild') {
      return card.effect === 'wilddraw4' ? '🌈' : '🎨';
    }
    return '🃏';
  }

  /**
   * Update game message with current state
   * @param {Message} message - Discord message to update
   * @param {UnoGameState} game - Game state
   * @param {string} userId - Current user ID (optional)
   */
  static async updateGameMessage(message, game, userId = null) {
    try {
      let embed, components;
      
      if (game.status === GAME_STATUS.LOBBY) {
        embed = this.createLobbyEmbed(game);
        components = [this.createLobbyButtons(game)];
      } else if (game.status === GAME_STATUS.ACTIVE) {
        embed = this.createGameEmbed(game);
        components = this.createGameButtons(game, userId);
      } else {
        // Game ended
        embed = this.createGameEndEmbed(game);
        components = [];
      }
      
      await message.edit({
        embeds: [embed],
        components: components
      });
    } catch (error) {
      console.error('Error updating game message:', error);
    }
  }
}

module.exports = UnoUI;