const { EmbedBuilder } = require('discord.js');
const config = require('../config/setup');

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

  // Parameters field (n/a for parent command)
  fields.push({ name: '**Parameters**', value: 'n/a', inline: true });

  // Information field (permissions with warning emoji)
  if (command.permission) {
    const permissionValue = `${config.emojis.warn} ${command.permission}`;
    fields.push({ name: '**Information**', value: permissionValue, inline: false });
  }

  // Usage field
  const usageLines = [
    `**Syntax:** ${guildPrefix}${command.name} (subcommand) <args>`,
    `**Example:** ${guildPrefix}${command.name} add (role)`
  ];
  fields.push({ name: '**Usage**', value: usageLines.join('\n'), inline: false });

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

  // Parameters field
  const paramValue = subcommand.parameters && subcommand.parameters.length > 0 
    ? subcommand.parameters.join(', ') 
    : 'n/a';
  fields.push({ name: '**Parameters**', value: paramValue, inline: true });

  // Information field (permissions with warning emoji)
  if (command.permission) {
    const permissionValue = `${config.emojis.warn} ${command.permission}`;
    fields.push({ name: '**Information**', value: permissionValue, inline: false });
  }

  // Usage field
  const usageLines = [];
  if (subcommand.syntax) {
    usageLines.push(`**Syntax:** ${subcommand.syntax}`);
  }
  if (subcommand.example) {
    usageLines.push(`**Example:** ${subcommand.example}`);
  }
  
  if (usageLines.length > 0) {
    fields.push({ name: '**Usage**', value: usageLines.join('\n'), inline: false });
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

  // Subcommands field (if exists)
  if (command.subcommands) {
    let subcommands = command.subcommands.replaceAll('{guildprefix}', guildPrefix);
    fields.push({ name: '**subcommands**', value: subcommands, inline: false });
  }

  // Aliases and permission as inline fields
  const aliasValue = command.aliases && command.aliases.length > 0 
    ? command.aliases.join(', ') 
    : 'n/a';
  const permissionValue = command.permission || 'n/a';

  fields.push({ name: '**Aliases**', value: aliasValue, inline: true });
  fields.push({ name: '**Permission**', value: permissionValue, inline: true });

  // Syntax field with code block
  if (command.usage) {
    let usage = command.usage.replaceAll('{guildprefix}', guildPrefix);
    fields.push({ name: '**Syntax**', value: `\`\`\`js\n${usage}\`\`\``, inline: false });
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
