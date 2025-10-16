const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "facepalm",
  description: "Facepalm at someone",
  usage: `{guildprefix}facepalm [@user]`,
  run: createRoleplayCommand('facepalm', 'facepalmed at')
};
