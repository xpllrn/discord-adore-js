const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "fuck",
  description: "NSFW roleplay command (18+ channels only)",
  syntax: 'fuck (user)',
  example: 'fuck @user',
  run: createNSFWRoleplayCommand('fuck', 'fucked')
};