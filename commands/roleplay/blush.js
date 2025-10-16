const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "blush",
  description: "Blush at someone",
  usage: `{guildprefix}blush [@user]`,
  run: createRoleplayCommand('blush', 'blushed at')
};
