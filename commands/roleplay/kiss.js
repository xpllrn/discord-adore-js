const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "kiss",
  description: "Give someone a sweet kiss",
  usage: `{guildprefix}kiss [@user]`,
  run: createRoleplayCommand('kiss', 'kissed')
};
