const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "bite",
  description: "Bite someone",
  usage: `{guildprefix}bite [@user]`,
  run: createRoleplayCommand('bite', 'bit')
};
