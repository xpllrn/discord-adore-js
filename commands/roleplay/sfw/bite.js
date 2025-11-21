const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "bite",
  description: "Bite someone",
  syntax: 'bite (user)',
  example: 'bite @vwsn',
  run: createRoleplayCommand('bite', 'bit'),
  data: getRoleplaySlashData('bite', 'Bite someone'),
  execute: executeRoleplaySlash('bite', 'bit')
};
