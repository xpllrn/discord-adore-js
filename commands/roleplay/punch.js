const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "punch",
  description: "Punch someone",
  usage: `{guildprefix}punch [@user]`,
  run: createRoleplayCommand('punch', 'punched')
};
