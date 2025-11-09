const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "angry",
  description: "Be angry at someone",
  syntax: 'angry (user)',
  example: 'angry @vwsn',
  run: createRoleplayCommand('angry', 'got angry at')
};
