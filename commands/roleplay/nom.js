const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "nom",
  description: "Nom on someone",
  usage: `{guildprefix}nom [@user]`,
  run: createRoleplayCommand('nom', 'nommed')
};
