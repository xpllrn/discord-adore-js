const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "headpat",
  description: "Give someone a nice headpat",
  usage: `{guildprefix}headpat [@user]`,
  run: createRoleplayCommand('pat', 'headpatted')
};
