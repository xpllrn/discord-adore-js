const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "nom",
  description: "Nom on someone",
  syntax: 'nom (user)',
  example: 'nom @vwsn',
  run: createRoleplayCommand('nom', 'nommed')
};
