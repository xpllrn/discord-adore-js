const { createRoleplayCommand } = require('../../../utils/roleplay');

module.exports = {
  name: "stare",
  description: "Stare at someone",
  syntax: 'stare (user)',
  example: 'stare @vwsn',
  run: createRoleplayCommand('stare', 'stared at')
};
