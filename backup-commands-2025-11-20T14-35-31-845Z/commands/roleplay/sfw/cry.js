const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "cry",
  description: "Cry at someone",
  syntax: 'cry (user)',
  example: 'cry @vwsn',
  run: createRoleplayCommand('cry', 'cried at')
};
