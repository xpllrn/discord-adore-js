const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "bonk",
  description: "Bonk someone",
  syntax: 'bonk (user)',
  example: 'bonk @vwsn',
  run: createRoleplayCommand('bonk', 'bonked')
};
