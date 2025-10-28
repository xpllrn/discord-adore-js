const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "fuck",
  description: "`NSFW` fuck roleplay command.",
  syntax: 'fuck (user)',
  example: 'fuck @vee',
  run: createNSFWRoleplayCommand('fuck', 'fucked')
};