const { ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const config = require('../../config/setup');

/**
 * Creates the parent command overview page (page 1)
 * @param {Object} command - Command object
 * @param {String} guildPrefix - Guild's command prefix
 * @param {Number} totalSubcommands - Total number of subcommands
 * @returns {ContainerBuilder} - Discord container for parent command
 */
function createParentCommandPage(command, guildPrefix, totalSubcommands) {
  const container = new ContainerBuilder()
    .setAccentColor(parseInt(config.colors.embed.replace('#', ''), 16));

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
    ? command.aliases.map(a => `> ${a}`).join('\n')
    : '> none';
  const permissionValue = command.permission || 'none';
  
  container.addTextDisplayComponents(
    (text) => text.setContent(`**Aliases**\n${aliasValue}\n\n**Permission**\n> ${permissionValue}`)
  );

  // Separator
  container.addSeparatorComponents(
    (separator) => separator.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  // Syntax
  container.addTextDisplayComponents(
    (text) => text.setContent(`**Syntax**\n\`\`\`\nSyntax: ${guildPrefix}${command.name} (subcommand) <args>\n\`\`\``)
  );

  // Separator
  container.addSeparatorComponents(
    (separator) => separator.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  // Footer with page counter
  const totalPages = totalSubcommands + 1;
  container.addTextDisplayComponents(
    (text) => text.setContent(`-# Page 1/${totalPages} (${totalSubcommands} entries) ∙ Module: ${command.name}`)
  );

  return container;
}

/**
 * Creates a subcommand detail page
 * @param {Object} command - Parent command object
 * @param {Object} subcommand - Subcommand data object
 * @param {Number} pageNumber - Current page number
 * @param {Number} totalPages - Total number of pages
 * @returns {ContainerBuilder} - Discord container for subcommand
 */
function createSubcommandPage(command, subcommand, pageNumber, totalPages) {
  const container = new ContainerBuilder()
    .setAccentColor(parseInt(config.colors.embed.replace('#', ''), 16));

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
    ? subcommand.aliases.map(a => `> ${a}`).join('\n')
    : '> none';
  const permissionValue = command.permission || 'none';
  
  container.addTextDisplayComponents(
    (text) => text.setContent(`**Aliases**\n${aliasValue}\n\n**Permission**\n> ${permissionValue}`)
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

  // Separator
  container.addSeparatorComponents(
    (separator) => separator.setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  // Footer with page counter
  const totalSubcommands = totalPages - 1;
  container.addTextDisplayComponents(
    (text) => text.setContent(`-# Page ${pageNumber}/${totalPages} (${totalSubcommands} entries) ∙ Module: ${command.name}`)
  );

  return container;
}

/**
 * Creates traditional single-container help (for commands without subcommands)
 * @param {Object} command - Command object
 * @param {String} guildPrefix - Guild's command prefix
 * @returns {ContainerBuilder} - Discord container
 */
function createTraditionalEmbed(command, guildPrefix) {
  const container = new ContainerBuilder()
    .setAccentColor(parseInt(config.colors.embed.replace('#', ''), 16));

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
    ? command.aliases.map(a => `> ${a}`).join('\n')
    : '> none';
  const permissionValue = command.permission || 'none';
  
  container.addTextDisplayComponents(
    (text) => text.setContent(`**Aliases**\n${aliasValue}\n\n**Permission**\n> ${permissionValue}`)
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
  createTraditionalEmbed
};
