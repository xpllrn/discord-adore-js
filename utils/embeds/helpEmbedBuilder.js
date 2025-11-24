const { EmbedBuilder } = require('discord.js');
const config = require('../../config/setup');

/**
 * Creates the parent command overview page (page 1)
 * @param {Object} command - Command object
 * @param {String} guildPrefix - Guild's command prefix
 * @param {Number} totalSubcommands - Total number of subcommands
 * @returns {EmbedBuilder} - Discord embed for parent command
 */
function createParentCommandPage(command, guildPrefix, totalSubcommands) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.embed)
    .setTitle(`Group Command: ${command.name}`)
    .setDescription(command.description || 'No description available');

  const fields = [];

  // Aliases field
  const aliasValue = command.aliases && command.aliases.length > 0
    ? command.aliases.join(', ')
    : 'none';
  fields.push({ name: '**Aliases**', value: aliasValue, inline: true });

  // Permission field - always show
  const permissionValue = command.permission || 'none';
  fields.push({ name: '**Permission**', value: permissionValue, inline: true });

  // Syntax field - only show syntax for group commands
  const syntaxValue = `\`\`\`Syntax: ${guildPrefix}${command.name} (subcommand) <args>\`\`\``;
  fields.push({ name: '**Syntax**', value: syntaxValue, inline: false });

  embed.addFields(...fields);

  // Footer with page counter and module name
  const totalPages = totalSubcommands + 1; // +1 for parent page
  embed.setFooter({
    text: `Page 1/${totalPages} (${totalSubcommands} entries) ∙ Module: ${command.name}`
  });

  return embed;
}

/**
 * Creates a subcommand detail page
 * @param {Object} command - Parent command object
 * @param {Object} subcommand - Subcommand data object
 * @param {Number} pageNumber - Current page number
 * @param {Number} totalPages - Total number of pages
 * @returns {EmbedBuilder} - Discord embed for subcommand
 */
function createSubcommandPage(command, subcommand, pageNumber, totalPages) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.embed)
    .setTitle(`Command: ${subcommand.fullCommand}`)
    .setDescription(subcommand.description || 'No description available');

  const fields = [];

  // Aliases field
  const aliasValue = subcommand.aliases && subcommand.aliases.length > 0
    ? subcommand.aliases.join(', ')
    : 'none';
  fields.push({ name: '**Aliases**', value: aliasValue, inline: true });

  // Permission field - always show
  const permissionValue = command.permission || 'none';
  fields.push({ name: '**Permission**', value: permissionValue, inline: true });

  // Syntax and Example fields
  const syntaxLines = [];
  if (subcommand.syntax) {
    syntaxLines.push(`Syntax: ${subcommand.syntax}`);
  }
  if (subcommand.example) {
    syntaxLines.push(`Example: ${subcommand.example}`);
  }

  if (syntaxLines.length > 0) {
    const syntaxValue = `\`\`\`${syntaxLines.join('\n')}\`\`\``;
    fields.push({ name: '**Syntax & Example**', value: syntaxValue, inline: false });
  }

  embed.addFields(...fields);

  // Footer with page counter and module name
  const totalSubcommands = totalPages - 1; // -1 for parent page
  embed.setFooter({
    text: `Page ${pageNumber}/${totalPages} (${totalSubcommands} entries) ∙ Module: ${command.name}`
  });

  return embed;
}

/**
 * Creates traditional single-embed help (for commands without subcommands)
 * @param {Object} command - Command object
 * @param {String} guildPrefix - Guild's command prefix
 * @returns {EmbedBuilder} - Discord embed
 */
function createTraditionalEmbed(command, guildPrefix) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.embed)
    .setTitle(`Command: ${command.name}`)
    .setDescription(command.description || 'No description available');

  const fields = [];

  // Aliases field
  const aliasValue = command.aliases && command.aliases.length > 0
    ? command.aliases.join(', ')
    : 'none';
  fields.push({ name: '**Aliases**', value: aliasValue, inline: true });

  // Permission field
  const permissionValue = command.permission || 'none';
  fields.push({ name: '**Permission**', value: permissionValue, inline: true });

  // Syntax and Example field
  if (command.syntax || command.example) {
    const syntaxValue = [];

    if (command.syntax) {
      const syntaxWithPrefix = `${guildPrefix}${command.syntax}`;
      syntaxValue.push(`Syntax: ${syntaxWithPrefix}`);
    }

    if (command.example) {
      const exampleWithPrefix = `${guildPrefix}${command.example}`;
      syntaxValue.push(`Example: ${exampleWithPrefix}`);
    }

    if (syntaxValue.length > 0) {
      fields.push({ name: '**Syntax & Example**', value: `\`\`\`${syntaxValue.join('\n')}\`\`\``, inline: false });
    }
  }

  if (fields.length > 0) {
    embed.addFields(...fields);
  }

  return embed;
}

module.exports = {
  createParentCommandPage,
  createSubcommandPage,
  createTraditionalEmbed
};
