const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "wave",
  description: "Wave at someone",
  syntax: 'wave (user)',
  example: 'wave @vwsn',
  run: createRoleplayCommand('wave', 'waved at')
};
