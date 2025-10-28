const { createRoleplayCommand } = require('../../../utils/roleplay');

module.exports = {
  name: "glomp",
  description: "Glomp someone",
  syntax: 'glomp (user)',
  example: 'glomp @vwsn',
  run: createRoleplayCommand('glomp', 'glomped')
};
