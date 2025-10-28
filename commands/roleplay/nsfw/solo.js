const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "solo",
  description: "NSFW roleplay command (18+ channels only)",
  syntax: 'solo',
  example: 'solo',
  run: createNSFWRoleplayCommand('solo', 'went solo')
};