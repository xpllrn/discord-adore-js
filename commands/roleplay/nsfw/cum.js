const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "cum",
  description: "NSFW roleplay command (18+ channels only)",
  syntax: 'cum (user)',
  example: 'cum @user',
  run: createNSFWRoleplayCommand('cum', 'came with')
};