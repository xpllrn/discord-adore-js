const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "kiss",
  description: "Give someone a sweet kiss",
  syntax: 'kiss (user)',
  example: 'kiss @vwsn',
  run: createRoleplayCommand('kiss', 'kissed'),
  data: getRoleplaySlashData('kiss', 'Give someone a sweet kiss'),
  execute: executeRoleplaySlash('kiss', 'kissed')
};
