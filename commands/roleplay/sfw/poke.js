const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "poke",
  description: "Poke someone",
  syntax: 'poke (user)',
  example: 'poke @vwsn',
  run: createRoleplayCommand('poke', 'poked'),
  data: getRoleplaySlashData('poke', 'Poke someone'),
  execute: executeRoleplaySlash('poke', 'poked')
};
