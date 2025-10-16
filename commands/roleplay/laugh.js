const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "laugh",
  description: "Laugh at someone",
  usage: `{guildprefix}laugh [@user]`,
  run: createRoleplayCommand('laugh', 'laughed at')
};
