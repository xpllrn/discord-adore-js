const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "laugh",
  description: "Laugh at someone",
  syntax: 'laugh (user)',
  example: 'laugh @vwsn',
  run: createRoleplayCommand('laugh', 'laughed at')
};
