const { createRoleplayCommand, getRoleplaySlashData, executeRoleplaySlash } = require('../../../utils/helpers');

module.exports = {
  name: "hug",
  description: "Give someone a warm hug",
  syntax: 'hug (user)',
  example: 'hug @vwsn',
  run: createRoleplayCommand('hug', 'hugged'),
  data: getRoleplaySlashData('hug', 'Give someone a warm hug'),
  execute: executeRoleplaySlash('hug', 'hugged')
};
