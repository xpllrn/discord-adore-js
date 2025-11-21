const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "dance",
  description: "Dance with someone",
  syntax: 'dance (user)',
  example: 'dance @vwsn',
  run: createRoleplayCommand('dance', 'danced with'),
  data: getRoleplaySlashData('dance', 'Dance with someone'),
  execute: executeRoleplaySlash('dance', 'danced with')
};
