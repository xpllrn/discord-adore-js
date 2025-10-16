const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "yeet",
  description: "Yeet someone",
  usage: `{guildprefix}yeet [@user]`,
  run: createRoleplayCommand('yeet', 'yeeted')
};
