const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "glomp",
  description: "Glomp someone",
  usage: `{guildprefix}glomp [@user]`,
  run: createRoleplayCommand('glomp', 'glomped')
};
