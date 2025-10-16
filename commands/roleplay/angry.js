const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "angry",
  description: "Be angry at someone",
  usage: `{guildprefix}angry [@user]`,
  run: createRoleplayCommand('angry', 'got angry at')
};
