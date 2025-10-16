const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "kill",
  description: "Kill someone (roleplay)",
  usage: `{guildprefix}kill [@user]`,
  run: createRoleplayCommand('kill', 'killed')
};
