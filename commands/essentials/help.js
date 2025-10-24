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
    console.log(`🔍 [HELP] Initial guildprefix: "${guildprefix}"`);
    console.log(`🔍 [HELP] Guild ID: "${message.guild.id}"`);

    try {
      // Check if database is ready first
      const { isDatabaseReady } = require('../../database');
      const dbStatus = isDatabaseReady();

      if (dbStatus.local || dbStatus.global) {
        // Try service layer approach first
        const { getService } = require('@services');
        const guildService = getService('guild');
        const cachedPrefix = await guildService.getPrefix(message.guild.id);
        console.log(`🔍 [HELP] Cached prefix from guildService: "${cachedPrefix}"`);
        if (cachedPrefix) {
          guildprefix = cachedPrefix;
          console.log(`🔍 [HELP] Updated guildprefix to: "${guildprefix}"`);
        }
      } else {
        console.log('Database not ready, using default prefix');
      }
    } catch (cacheError) {
      console.error('Error getting guild prefix, using default:', cacheError.message);
      // guildprefix is already set to default
    }

    console.log(`🔍 [HELP] Final guildprefix before usage: "${guildprefix}"`);
    console.log(`🔍 [HELP] Type of guildprefix: ${typeof guildprefix}`);

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
        console.log(`🔍 [HELP] After replacement - usage contains: "${usage.substring(0, 100)}..."`);
        if (usage.includes(message.guild.id)) {
          console.log(`⚠️ [HELP] WARNING: Usage contains guild ID! Full usage: "${usage}"`);
        }
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