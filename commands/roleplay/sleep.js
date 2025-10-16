const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "sleep",
  description: "Sleep with someone",
  usage: `{guildprefix}sleep [@user]`,
  run: createRoleplayCommand('sleep', 'slept with')
};
