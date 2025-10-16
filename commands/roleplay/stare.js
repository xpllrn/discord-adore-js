const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "stare",
  description: "Stare at someone",
  usage: `{guildprefix}stare [@user]`,
  run: createRoleplayCommand('stare', 'stared at')
};
