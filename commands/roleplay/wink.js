const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "wink",
  description: "Wink at someone",
  usage: `{guildprefix}wink [@user]`,
  run: createRoleplayCommand('wink', 'winked at')
};
