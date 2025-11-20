const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "bonk",
  description: "Bonk someone",
  syntax: 'bonk (user)',
  example: 'bonk @vwsn',
  run: createRoleplayCommand('bonk', 'bonked')
};
