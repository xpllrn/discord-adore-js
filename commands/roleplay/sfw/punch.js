const { createRoleplayCommand } = require('../../../utils/roleplay');

module.exports = {
  name: "punch",
  description: "Punch someone",
  syntax: 'punch (user)',
  example: 'punch @vwsn',
  run: createRoleplayCommand('punch', 'punched')
};
