const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "blowjob",
  description: "NSFW roleplay command (18+ channels only)",
  syntax: 'blowjob (user)',
  example: 'blowjob @user',
  run: createNSFWRoleplayCommand('blowjob', 'gave a blowjob to')
};