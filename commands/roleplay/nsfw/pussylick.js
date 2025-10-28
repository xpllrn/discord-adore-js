const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "pussylick",
  description: "NSFW roleplay command (18+ channels only)",
  syntax: 'pussylick (user)',
  example: 'pussylick @user',
  run: createNSFWRoleplayCommand('pussylick', 'licked')
};