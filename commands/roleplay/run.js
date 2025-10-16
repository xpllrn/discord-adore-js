const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "run",
  description: "Run from someone",
  usage: `{guildprefix}run [@user]`,
  run: createRoleplayCommand('run', 'ran from')
};
