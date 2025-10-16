const config = require('../../config/setup');
const { embeds } = require('../../core/embeds');
const glob = require("glob");

module.exports = {
  name: "reload",
  description: 'Reloads all commands',
  usage: `{guildprefix}reload`,
  cooldowns: 3600,

  run: async (client, message) => {
    if (message.author.id !== config.bot.ownerId) {
      return embeds.warn(message, 'You need to be the **Bot Owner** to use this command!');
    }

    try {
      client.commands.clear();
      client.aliases.clear();

      const { promisify } = require('util');
      const globAsync = promisify(glob);

      const filePaths = await globAsync(`${__dirname}/../**/*.js`);
      let reloadedCount = 0;

      filePaths.forEach((file) => {
        delete require.cache[require.resolve(file)];

        try {
          const pull = require(file);
          if (pull.name) {
            client.commands.set(pull.name, pull);
            reloadedCount++;

            if (pull.aliases && Array.isArray(pull.aliases)) {
              pull.aliases.forEach((alias) => {
                client.aliases.set(alias, pull.name);
              });
            }
          }
        } catch (error) {

        }
      });

      return embeds.success(message, `Successfully **reloaded ${reloadedCount}** commands!`);

    } catch (error) {

      return embeds.warn(message, `Error reloading commands: ${error.message}`);
    }
  }
}
