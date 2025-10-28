const { EmbedBuilder } = require('discord.js')
const path = require('path')
const config = require('./../../config/setup')
const { embeds } = require('../../core/embeds')
const { hasSubcommands, parseSubcommands, getCommandFilePath } = require('../../utils/subcommandParser')
const { createParentCommandPage, createSubcommandPage, createTraditionalEmbed } = require('../../utils/helpEmbedBuilder')
const { createPagination } = require('../../core/buttons')

module.exports = {
  name: "help",
  aliases: ['h', 'command'],
  description: `View extended help for commands`,
  syntax: 'help (command)',
  example: 'help crash',
  run: async(client, message, args) => {

    // Get guild prefix with multiple fallback methods for reliability
    let guildprefix = config.bot.defaultPrefix; // Default fallback

    try {
      // Check if database is ready first
      const { isDatabaseReady } = require('../../database');
      const dbStatus = isDatabaseReady();

      if (dbStatus.local || dbStatus.global) {
        // Try service layer approach first
        const { getService } = require('@services');
        const guildService = getService('guild');
        const cachedPrefix = await guildService.getPrefix(message.guild.id);
        if (cachedPrefix) {
          guildprefix = cachedPrefix;
        }
      }
    } catch (cacheError) {
      // guildprefix is already set to default
    }

    const command = client.commands.get(args[0]) || client.commands.get(client.aliases.get(args[0]))
  
    if (command) {
      // Check if this is a group command with subcommands
      if (hasSubcommands(command)) {
        try {
          // Get the command file path
          const commandsDir = path.join(__dirname, '..');
          const commandFilePath = getCommandFilePath(command.name, commandsDir);
          
          if (!commandFilePath) {
            // Fall back to traditional embed
            const embed = createTraditionalEmbed(command, guildprefix);
            return message.channel.send({ embeds: [embed] });
          }

          // Parse subcommands from the file
          const subcommands = parseSubcommands(commandFilePath, command.name, guildprefix);
          
          if (subcommands.length === 0) {
            // Fall back to traditional embed
            const embed = createTraditionalEmbed(command, guildprefix);
            return message.channel.send({ embeds: [embed] });
          }

          // Check if user is asking for a specific subcommand (e.g., "h ar add")
          if (args[1]) {
            const requestedSubcommand = args[1].toLowerCase();
            
            // Find the matching subcommand (check both name and aliases)
            const matchedSubcommand = subcommands.find(sub => 
              sub.name.toLowerCase() === requestedSubcommand || 
              (sub.aliases && sub.aliases.some(alias => alias.toLowerCase() === requestedSubcommand))
            );

            if (matchedSubcommand) {
              // Show ONLY this subcommand's info (no pagination, no buttons)
              const singleSubcommandEmbed = createSubcommandPage(command, matchedSubcommand, 1, 1);
              // Remove the footer with page numbers since it's a single page
              singleSubcommandEmbed.setFooter({ text: `Module: ${command.name}` });
              return message.channel.send({ embeds: [singleSubcommandEmbed] });
            } else {
              // Subcommand not found, fall back to showing full group command help
              // Continue to show paginated help below
            }
          }

          // Create page array: parent page + subcommand pages
          const pages = [];
          
          // Page 1: Parent command overview
          pages.push(createParentCommandPage(command, guildprefix, subcommands.length));
          
          // Pages 2+: Individual subcommand pages
          const totalPages = subcommands.length + 1;
          subcommands.forEach((subcommand, index) => {
            const pageNumber = index + 2; // +2 because page 1 is parent
            pages.push(createSubcommandPage(command, subcommand, pageNumber, totalPages));
          });

          // Display paginated help using prebuilt pagination
          return createPagination(
            message,
            pages,
            (pageItems, currentPage, totalPages) => pageItems[0], // formatPage function returns the embed
            1, // 1 item per page (each item is already a full embed)
            command.name
          );

        } catch (error) {
          // Fall back to traditional embed on error
          const embed = createTraditionalEmbed(command, guildprefix);
          return message.channel.send({ embeds: [embed] });
        }
      } else {
        // Traditional single-embed help for commands without subcommands
        const embed = createTraditionalEmbed(command, guildprefix);
        return message.channel.send({ embeds: [embed] });
      }

    } else if (args.length > 0) {

      return embeds.warn(message, `Command **${args[0]}** does not exist`)

    } else {

      return message.channel.send(`https://adore.vly.site/, check out discord @ https://adore.vly.site/server`)
    }
  }}
