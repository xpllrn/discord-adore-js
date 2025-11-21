const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "bonk",
  description: "Bonk someone",
  syntax: 'bonk (user)',
  example: 'bonk @vwsn',
  run: createRoleplayCommand('bonk', 'bonked'),
  data: getRoleplaySlashData('bonk', 'Bonk someone'),
  execute: executeRoleplaySlash('bonk', 'bonked')
};
