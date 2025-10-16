const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "bully",
  description: "Bully someone",
  usage: `{guildprefix}bully [@user]`,
  run: createRoleplayCommand('bully', 'bullied')
};
