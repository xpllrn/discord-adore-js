const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "cry",
  description: "Cry at someone",
  usage: `{guildprefix}cry [@user]`,
  run: createRoleplayCommand('cry', 'cried at')
};
