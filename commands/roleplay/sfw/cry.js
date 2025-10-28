const { createRoleplayCommand } = require('../../../utils/roleplay');

module.exports = {
  name: "cry",
  description: "Cry at someone",
  syntax: 'cry (user)',
  example: 'cry @vwsn',
  run: createRoleplayCommand('cry', 'cried at')
};
