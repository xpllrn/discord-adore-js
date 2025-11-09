const { createRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "glomp",
  description: "Glomp someone",
  syntax: 'glomp (user)',
  example: 'glomp @vwsn',
  run: createRoleplayCommand('glomp', 'glomped')
};
