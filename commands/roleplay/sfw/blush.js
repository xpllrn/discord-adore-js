const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "blush",
  description: "Blush at someone",
  syntax: 'blush (user)',
  example: 'blush @vwsn',
  run: createRoleplayCommand('blush', 'blushed at'),
  data: getRoleplaySlashData('blush', 'Blush at someone'),
  execute: executeRoleplaySlash('blush', 'blushed at')
};
