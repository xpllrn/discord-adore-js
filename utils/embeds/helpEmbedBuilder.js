const { ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const config = require('../../config/setup');

// Cache for guild embed colors (synced with core/embeds.js)
const colorCache = new Map();
const COLOR_CACHE_TTL = 60000; // 1 minute

/**
 * Get guild's custom embed color with caching
 * @param {string} guildId - Guild ID
 * @returns {Promise<string|null>} Custom color, 'none', or null for default
 */
async function getGuildEmbedColor(guildId) {
  if (!guildId) return null;
  
  // Check cache first
  const cached = colorCache.get(guildId);
  if (cached && Date.now() - cached.timestamp < COLOR_CACHE_TTL) {
    return cached.color;
  }
  
  try {
    const { getService } = require('@services');
    const guildService = getService('guild');
    const color = await guildService.getEmbedColor(guildId);
    
    // Cache the result
    colorCache.set(guildId, { color, timestamp: Date.now() });
    return color;
  } catch (error) {
    return null;
  }
}

/**
 * Resolve embed color for a guild
 * @param {string} guildId - Guild ID
 * @returns {Promise<number|null>} Color as integer, or null for no color
 */
async function resolveContainerColor(guildId) {
  const customColor = await getGuildEmbedColor(guildId);
  
  // 'none' means no color
  if (customColor === 'none') return null;
  
  // Use custom color if set, otherwise default
  const colorHex = customColor || config.colors.embed;
  return parseInt(colorHex.replace('#', ''), 16);
}

/**
 * Creates the parent command overview page (page 1)
 * @param {Object} command - Command object
 * @param {String} guildPrefix - Guild's command prefix
 * @param {Number} totalSubcommands - Total number of subcommands
 * @param {number|null} accentColor - Accent color (null for no color)
 * @returns {ContainerBuilder} - Discord container for parent command
 */
function createParentCommandPage(command, guildPrefix, totalSubcommands, accentColor = null) {
  const container = new ContainerBuilder();
  
  // Only set accent color if not null
  if (accentColor !== null) {
    container.setAccentColor(accentColor);
  }

  // Title and description
  container.addTextDisplayComponents(
    (text) => text.setContent(`## Group Command: ${command.name}\n${command.description || 'No description available'}`)
  );

  // Separator
  container.addSeparatorComponents(
    (separator) => separator.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  // Aliases and Permission
  const aliasValue = command.aliases && command.aliases.length > 0
    ? command.aliases.join(', ')
    : 'none';
  const permissionValue = command.permission || 'none';
  
  container.addTextDisplayComponents(
    (text) => text.setContent(`**Aliases**\n${aliasValue}\n\n**Permission**\n${permissionValue}`)
  );

  // Separator
  container.addSeparatorComponents(
    (separator) => separator.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  // Syntax
  container.addTextDisplayComponents(
    (text) => text.setContent(`**Syntax**\n\`\`\`\nSyntax: ${guildPrefix}${command.name} (subcommand) <args>\n\`\`\``)
  );

  return container;
}

/**
 * Adds pagination buttons to a container
 * @param {ContainerBuilder} container - Container to add buttons to
 * @param {Number} currentPage - Current page number
 * @param {Number} totalPages - Total number of pages
 * @param {Boolean} disabled - Whether buttons should be disabled
 * @returns {ContainerBuilder} - Container with buttons added
 */
function addPaginationButtons(container, currentPage, totalPages, disabled = false) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const { emojis } = require('../../config/setup');

  container.addSeparatorComponents(
    (separator) => separator.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  container.addActionRowComponents((actionRow) =>
    actionRow.setComponents(
      new ButtonBuilder()
        .setCustomId('pagination_left')
        .setEmoji(emojis.left)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || currentPage === 1),
      new ButtonBuilder()
        .setCustomId('pagination_cancel')
        .setEmoji(emojis.cancel)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('pagination_right')
        .setEmoji(emojis.right)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || currentPage === totalPages),
      new ButtonBuilder()
        .setCustomId('pagination_move')
        .setEmoji(emojis.choose)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || totalPages === 1)
    )
  );

  return container;
}

/**
 * Adds footer to a container
 * @param {ContainerBuilder} container - Container to add footer to
 * @param {Number} currentPage - Current page number
 * @param {Number} totalPages - Total number of pages
 * @param {Number} totalEntries - Total number of entries
 * @param {String} moduleName - Module name
 * @returns {ContainerBuilder} - Container with footer added
 */
function addFooter(container, currentPage, totalPages, totalEntries, moduleName) {
  container.addSeparatorComponents(
    (separator) => separator.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  container.addTextDisplayComponents(
    (text) => text.setContent(`-# Page ${currentPage}/${totalPages} (${totalEntries} entries) ∙ Module: ${moduleName}`)
  );

  return container;
}

/**
 * Creates a subcommand detail page
 * @param {Object} command - Parent command object
 * @param {Object} subcommand - Subcommand data object
 * @param {Number} pageNumber - Current page number
 * @param {Number} totalPages - Total number of pages
 * @param {number|null} accentColor - Accent color (null for no color)
 * @returns {ContainerBuilder} - Discord container for subcommand
 */
function createSubcommandPage(command, subcommand, pageNumber, totalPages, accentColor = null) {
  const container = new ContainerBuilder();
  
  // Only set accent color if not null
  if (accentColor !== null) {
    container.setAccentColor(accentColor);
  }

  // Title and description
  container.addTextDisplayComponents(
    (text) => text.setContent(`## Command: ${subcommand.fullCommand}\n${subcommand.description || 'No description available'}`)
  );

  // Separator
  container.addSeparatorComponents(
    (separator) => separator.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  // Aliases and Permission
  const aliasValue = subcommand.aliases && subcommand.aliases.length > 0
    ? subcommand.aliases.join(', ')
    : 'none';
  const permissionValue = command.permission || 'none';
  
  container.addTextDisplayComponents(
    (text) => text.setContent(`**Aliases**\n${aliasValue}\n\n**Permission**\n${permissionValue}`)
  );

  // Syntax and Example
  const syntaxLines = [];
  if (subcommand.syntax) {
    syntaxLines.push(`Syntax: ${subcommand.syntax}`);
  }
  if (subcommand.example) {
    syntaxLines.push(`Example: ${subcommand.example}`);
  }

  if (syntaxLines.length > 0) {
    // Separator
    container.addSeparatorComponents(
      (separator) => separator.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    container.addTextDisplayComponents(
      (text) => text.setContent(`**Syntax**\n\`\`\`\n${syntaxLines.join('\n')}\n\`\`\``)
    );
  }

  return container;
}

/**
 * Creates traditional single-container help (for commands without subcommands)
 * @param {Object} command - Command object
 * @param {String} guildPrefix - Guild's command prefix
 * @param {number|null} accentColor - Accent color (null for no color)
 * @returns {ContainerBuilder} - Discord container
 */
function createTraditionalEmbed(command, guildPrefix, accentColor = null) {
  const container = new ContainerBuilder();
  
  // Only set accent color if not null
  if (accentColor !== null) {
    container.setAccentColor(accentColor);
  }

  // Title and description
  container.addTextDisplayComponents(
    (text) => text.setContent(`## Command: ${command.name}\n${command.description || 'No description available'}`)
  );

  // Separator
  container.addSeparatorComponents(
    (separator) => separator.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  // Aliases and Permission
  const aliasValue = command.aliases && command.aliases.length > 0
    ? command.aliases.join(', ')
    : 'none';
  const permissionValue = command.permission || 'none';
  
  container.addTextDisplayComponents(
    (text) => text.setContent(`**Aliases**\n${aliasValue}\n\n**Permission**\n${permissionValue}`)
  );

  // Syntax and Example
  if (command.syntax || command.example) {
    const syntaxLines = [];

    if (command.syntax) {
      const syntaxWithPrefix = `${guildPrefix}${command.syntax}`;
      syntaxLines.push(`Syntax: ${syntaxWithPrefix}`);
    }

    if (command.example) {
      const exampleWithPrefix = `${guildPrefix}${command.example}`;
      syntaxLines.push(`Example: ${exampleWithPrefix}`);
    }

    if (syntaxLines.length > 0) {
      // Separator
      container.addSeparatorComponents(
        (separator) => separator.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );

      container.addTextDisplayComponents(
        (text) => text.setContent(`**Syntax**\n\`\`\`\n${syntaxLines.join('\n')}\n\`\`\``)
      );
    }
  }

  return container;
}

module.exports = {
  createParentCommandPage,
  createSubcommandPage,
  createTraditionalEmbed,
  addPaginationButtons,
  addFooter,
  resolveContainerColor,
  getGuildEmbedColor
};
