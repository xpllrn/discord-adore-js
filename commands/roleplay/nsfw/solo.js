const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "solo",
  description: "`NSFW` solo roleplay command.",
  syntax: 'solo',
  example: 'solo',
  run: createNSFWRoleplayCommand('solo', 'went solo')
};