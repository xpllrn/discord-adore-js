const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "bully",
  description: "Bully someone",
  syntax: 'bully (user)',
  example: 'bully @vwsn',
  run: createRoleplayCommand('bully', 'bullied'),
  data: getRoleplaySlashData('bully', 'Bully someone'),
  execute: executeRoleplaySlash('bully', 'bullied')
};
