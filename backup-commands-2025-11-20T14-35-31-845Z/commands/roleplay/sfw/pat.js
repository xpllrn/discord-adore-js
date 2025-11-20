const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "pat",
  description: "Give someone a gentle pat",
  syntax: 'pat (user)',
  example: 'pat @vwsn',
  run: createRoleplayCommand('pat', 'patted')
};
