const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "poke",
  description: "Poke someone",
  usage: `{guildprefix}poke [@user]`,
  run: createRoleplayCommand('poke', 'poked')
};
