const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "cry",
  description: "Cry at someone",
  syntax: 'cry (user)',
  example: 'cry @vwsn',
  run: createRoleplayCommand('cry', 'cried at'),
  data: getRoleplaySlashData('cry', 'Cry at someone'),
  execute: executeRoleplaySlash('cry', 'cried at')
};
