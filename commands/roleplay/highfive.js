const { createRoleplayCommand } = require('../../utils/roleplay');

module.exports = {
  name: "highfive",
  aliases: ['hi5'],
  description: "Give someone a high five",
  usage: `{guildprefix}highfive [@user]`,
  run: createRoleplayCommand('highfive', 'high-fived')
};
