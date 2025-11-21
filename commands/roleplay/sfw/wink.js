const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "wink",
  description: "Wink at someone",
  syntax: 'wink (user)',
  example: 'wink @vwsn',
  run: createRoleplayCommand('wink', 'winked at'),
  data: getRoleplaySlashData('wink', 'Wink at someone'),
  execute: executeRoleplaySlash('wink', 'winked at')
};
