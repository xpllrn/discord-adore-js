const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "pat",
  description: "Give someone a gentle pat",
  usage: `{guildprefix}pat [@user]`,
  run: createRoleplayCommand('pat', 'patted')
};
