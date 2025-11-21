const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "yeet",
  description: "Yeet someone",
  syntax: 'yeet (user)',
  example: 'yeet @vwsn',
  run: createRoleplayCommand('yeet', 'yeeted'),
  data: getRoleplaySlashData('yeet', 'Yeet someone'),
  execute: executeRoleplaySlash('yeet', 'yeeted')
};
