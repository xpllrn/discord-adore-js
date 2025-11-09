const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "kill",
  description: "Kill someone (roleplay)",
  syntax: 'kill (user)',
  example: 'kill @vwsn',
  run: createRoleplayCommand('kill', 'killed')
};
