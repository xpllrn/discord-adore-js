const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "cuddle",
  description: "Cuddle with someone",
  syntax: 'cuddle (user)',
  example: 'cuddle @vwsn',
  run: createRoleplayCommand('cuddle', 'cuddled'),
  data: getRoleplaySlashData('cuddle', 'Cuddle with someone'),
  execute: executeRoleplaySlash('cuddle', 'cuddled')
};
