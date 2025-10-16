const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "bonk",
  description: "Bonk someone",
  usage: `{guildprefix}bonk [@user]`,
  run: createRoleplayCommand('bonk', 'bonked')
};
