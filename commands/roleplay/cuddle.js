const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "cuddle",
  description: "Cuddle with someone",
  usage: `{guildprefix}cuddle [@user]`,
  run: createRoleplayCommand('cuddle', 'cuddled')
};
