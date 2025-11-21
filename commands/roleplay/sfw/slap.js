const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "slap",
  description: "Slap someone",
  syntax: 'slap (user)',
  example: 'slap @vwsn',
  run: createRoleplayCommand('slap', 'slapped'),
  data: getRoleplaySlashData('slap', 'Slap someone'),
  execute: executeRoleplaySlash('slap', 'slapped')
};
