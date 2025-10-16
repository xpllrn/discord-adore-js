const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "dance",
  description: "Dance with someone",
  usage: `{guildprefix}dance [@user]`,
  run: createRoleplayCommand('dance', 'danced with')
};
