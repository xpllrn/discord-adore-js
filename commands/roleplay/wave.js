const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "wave",
  description: "Wave at someone",
  usage: `{guildprefix}wave [@user]`,
  run: createRoleplayCommand('wave', 'waved at')
};
