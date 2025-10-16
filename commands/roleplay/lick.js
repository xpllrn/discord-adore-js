const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "lick",
  description: "Lick someone",
  usage: `{guildprefix}lick [@user]`,
  run: createRoleplayCommand('lick', 'licked')
};
