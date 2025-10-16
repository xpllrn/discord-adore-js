const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "tickle",
  description: "Tickle someone",
  usage: `{guildprefix}tickle [@user]`,
  run: createRoleplayCommand('tickle', 'tickled')
};
