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
    : 'n/a';
  fields.push({ name: '**Aliases**', value: aliasValue, inline: true });

  // Permission field
  if (command.permission) {
    fields.push({ name: '**Permission**', value: command.permission, inline: true });
  }

  // Usage field - only show syntax for group commands
  const usageValue = `\`\`\`Syntax: ${guildPrefix}${command.name} (subcommand) <args>\`\`\``;
  fields.push({ name: '**Usage**', value: usageValue, inline: false });

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
    : 'n/a';
  fields.push({ name: '**Aliases**', value: aliasValue, inline: true });

  // Permission field
  if (command.permission) {
    fields.push({ name: '**Permission**', value: command.permission, inline: true });
  }

  // Usage field
  const usageLines = [];
  if (subcommand.syntax) {
    usageLines.push(`Syntax: ${subcommand.syntax}`);
  }
  if (subcommand.example) {
    usageLines.push(`Example: ${subcommand.example}`);
  }

  if (usageLines.length > 0) {
    const usageValue = `\`\`\`${usageLines.join('\n')}\`\`\``;
    fields.push({ name: '**Usage**', value: usageValue, inline: false });
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
    : 'n/a';
  fields.push({ name: '**Aliases**', value: aliasValue, inline: true });

  // Permission field
  const permissionValue = command.permission || 'n/a';
  fields.push({ name: '**Permission**', value: permissionValue, inline: true });

  // Usage field with syntax and example
  if (command.syntax || command.example) {
    const usageValue = [];

    if (command.syntax) {
      const syntaxWithPrefix = `${guildPrefix}${command.syntax}`;
      usageValue.push(`Syntax: ${syntaxWithPrefix}`);
    }

    if (command.example) {
      const exampleWithPrefix = `${guildPrefix}${command.example}`;
      usageValue.push(`Example: ${exampleWithPrefix}`);
    }

    if (usageValue.length > 0) {
      fields.push({ name: '**Usage**', value: `\`\`\`${usageValue.join('\n')}\`\`\``, inline: false });
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
