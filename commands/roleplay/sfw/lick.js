const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "lick",
  description: "Lick someone",
  syntax: 'lick (user)',
  example: 'lick @vwsn',
  run: createRoleplayCommand('lick', 'licked'),
  data: getRoleplaySlashData('lick', 'Lick someone'),
  execute: executeRoleplaySlash('lick', 'licked')
};
