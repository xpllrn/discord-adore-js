const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "wave",
  description: "Wave at someone",
  syntax: 'wave (user)',
  example: 'wave @vwsn',
  run: createRoleplayCommand('wave', 'waved at'),
  data: getRoleplaySlashData('wave', 'Wave at someone'),
  execute: executeRoleplaySlash('wave', 'waved at')
};
