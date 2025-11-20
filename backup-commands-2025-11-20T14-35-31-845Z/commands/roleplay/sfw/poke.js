const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "poke",
  description: "Poke someone",
  syntax: 'poke (user)',
  example: 'poke @vwsn',
  run: createRoleplayCommand('poke', 'poked')
};
