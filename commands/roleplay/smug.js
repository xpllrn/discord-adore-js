const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "smug",
  description: "Be smug at someone",
  usage: `{guildprefix}smug [@user]`,
  run: createRoleplayCommand('smug', 'smugged at')
};
