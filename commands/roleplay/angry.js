const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "angry",
  description: "Be angry at someone",
  syntax: 'angry (user)',
  example: 'angry @vwsn',
  run: createRoleplayCommand('angry', 'got angry at')
};
