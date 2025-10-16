const { EmbedBuilder } = require('discord.js')
const config = require('./../../config/setup')
const { embeds } = require('../../core/embeds')

module.exports = {
  name: "help",
  aliases: ['h'],
  description: `Shows more information about a command`,
  usage: `{guildprefix}help
{guildprefix}help [command]`,
  run: async(client, message, args) => {

    // Get guild prefix with multiple fallback methods for reliability
    let guildprefix = config.bot.defaultPrefix; // Default fallback

    try {
      // Check if database is ready first
      const { isDatabaseReady } = require('../../database');
      const dbStatus = isDatabaseReady();

      if (dbStatus.local || dbStatus.global) {
        // Try cache-based approach first
        const guildCache = require('../../database/cache/models/guild');
        const cachedPrefix = await guildCache.getPrefix(message.guild.id);
        if (cachedPrefix) {
          guildprefix = cachedPrefix;
        }
      } else {
        console.log('Database not ready, using default prefix');
      }
    } catch (cacheError) {
      console.error('Error getting guild prefix, using default:', cacheError.message);
      // guildprefix is already set to default
    }

    const command = client.commands.get(args[0]) || client.commands.get(client.aliases.get(args[0]))
  
    if (command) {

      const embed = new EmbedBuilder()

      .setColor(config.colors.embed)
      .setTitle(`Command: ${command.name}`)
      .setDescription(`${command.description}`)

      const fields = [];

      if (command.subcommands) {
        let subcommands = command.subcommands
        subcommands = subcommands.replaceAll('{guildprefix}', guildprefix)
        fields.push({ name: '**subcommands**', value: `${subcommands}`, inline: false });
      }

      // Add aliases and permission as inline fields (always show both)
      const aliasValue = command.aliases ? command.aliases.join(', ') : 'na';
      const permissionValue = command.permission ? command.permission : 'na';

      fields.push({ name: '**Aliases**', value: aliasValue, inline: true });
      fields.push({ name: '**Permission**', value: permissionValue, inline: true });

      // Add syntax with JavaScript highlighting
      if (command.usage) {
        let usage = command.usage
        usage = usage.replaceAll('{guildprefix}', guildprefix)
        fields.push({ name: '**Syntax**', value: `\`\`\`js\n${usage}\`\`\``, inline: false });
      }


      if (fields.length > 0) {
        embed.addFields(...fields);
      }

      return message.channel.send({ embeds: [embed] })

    } else if (args.length > 0) {

      return embeds.warn(message, `Command **${args[0]}** does not exist`)

    } else {

      return message.channel.send(`Check out the website here for more help: https://adorebot.netlify.app/`)
    }
  }
}