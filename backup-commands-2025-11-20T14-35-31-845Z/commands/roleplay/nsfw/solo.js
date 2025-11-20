const { createNSFWRoleplayCommand } = require('../../../utils/helpers');

module.exports = {
  name: "solo",
  description: "`NSFW` solo roleplay command.",
  syntax: 'solo',
  example: 'solo',
  run: createNSFWRoleplayCommand('solo', 'went solo')
};