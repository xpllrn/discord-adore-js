const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "nom",
  description: "Nom on someone",
  syntax: 'nom (user)',
  example: 'nom @vwsn',
  run: createRoleplayCommand('nom', 'nommed'),
  data: getRoleplaySlashData('nom', 'Nom on someone'),
  execute: executeRoleplaySlash('nom', 'nommed')
};
