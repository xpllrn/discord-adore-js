const { embeds } = require('../../core/embeds');
const config = require('../../config/setup');
const database = require('../../database');

module.exports = {
  name: 'whitelist',
  aliases: ['wl'],
  description: 'Manage whitelisted servers.',
  usage: '{guildprefix}whitelist [add/remove/list] [serverId]',
  run: async (client, message, args) => {
    if (message.author.id !== config.bot.ownerId) {
      return;
    }

    const subcommand = args[0] ? args[0].toLowerCase() : 'list';
    const serverId = args[1];

    const { System } = database;
    if (!System) return embeds.deny(message, 'Database is not yet ready, please try again.');

    let systemData = await System.findOne({ _id: 'system' });
    if (!systemData) {
      systemData = new System();
    }

    switch (subcommand) {
      case 'add':
        if (!serverId) {
          return embeds.deny(message, 'Please provide a server ID to add.');
        }
        if (systemData.whitelistedGuilds.includes(serverId)) {
          return embeds.warn(message, 'That server is already whitelisted.');
        }
        systemData.whitelistedGuilds.push(serverId);
        await systemData.save();
        return embeds.success(message, `Server \`${serverId}\` has been whitelisted.`);
      case 'remove':
        if (!serverId) {
          return embeds.deny(message, 'Please provide a server ID to remove.');
        }
        if (!systemData.whitelistedGuilds.includes(serverId)) {
          return embeds.warn(message, 'That server is not whitelisted.');
        }
        systemData.whitelistedGuilds = systemData.whitelistedGuilds.filter(id => id !== serverId);
        await systemData.save();
        return embeds.success(message, `Server \`${serverId}\` has been removed from the whitelist.`);
      case 'list':
        if (systemData.whitelistedGuilds.length === 0) {
          return embeds.info(message, 'There are no whitelisted servers.');
        }
        return embeds.info(message, `Whitelisted servers: \`\`\`${systemData.whitelistedGuilds.join('\n')}\`\`\``);
      default:
        return embeds.deny(message, 'Invalid subcommand. Use `add`, `remove`, or `list`.');
    }
  }
};
