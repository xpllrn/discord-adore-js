const { createNSFWRoleplayCommand } = require('../../../utils/nsfwRoleplay');

module.exports = {
  name: "blowjob",
  description: "`NSFW` blowjob roleplay command.",
  syntax: 'blowjob (user)',
  example: 'blowjob @vee',
  run: createNSFWRoleplayCommand('blowjob', 'gave a blowjob to')
};