const { createRoleplayCommand } = require('../../../utils/roleplay');

module.exports = {
  name: "bully",
  description: "Bully someone",
  syntax: 'bully (user)',
  example: 'bully @vwsn',
  run: createRoleplayCommand('bully', 'bullied')
};
