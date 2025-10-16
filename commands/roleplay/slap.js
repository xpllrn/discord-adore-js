const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "slap",
  description: "Slap someone",
  usage: `{guildprefix}slap [@user]`,
  run: createRoleplayCommand('slap', 'slapped')
};
