const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "hug",
  description: "Give someone a warm hug",
  usage: `{guildprefix}hug [@user]`,
  run: createRoleplayCommand('hug', 'hugged')
};
