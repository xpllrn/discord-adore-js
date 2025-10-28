const { createRoleplayCommand } = require('../../../utils/roleplay');

module.exports = {
  name: "kill",
  description: "Kill someone (roleplay)",
  syntax: 'kill (user)',
  example: 'kill @vwsn',
  run: createRoleplayCommand('kill', 'killed')
};
