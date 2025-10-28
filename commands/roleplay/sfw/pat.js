const { createRoleplayCommand } = require('../../../utils/roleplay');

module.exports = {
  name: "pat",
  description: "Give someone a gentle pat",
  syntax: 'pat (user)',
  example: 'pat @vwsn',
  run: createRoleplayCommand('pat', 'patted')
};
