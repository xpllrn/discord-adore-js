const { runHelpCommand } = require('../../../utils/commandProcessor');
const { embeds } = require('../../../core/embeds');
const logger = require('../../../utils/logger');

module.exports = {
  name: "8ball",
  aliases: ['8b'],
  description: `ask the magic 8-ball a question`,
  syntax: '8ball [question]',
  example: '8ball will I be rich?',
  run: async(client, message, args) => {

    try {
      const question = args.join(" ");

      const answers = [
        'no',                          'yes',                         'ur mom lol',
        'it is certain',              'Most likely',                 'Outlook good',
        'Very doubtful',              'Without a doubt',             'Ask again later',
        'My reply is no',             'You may rely on it',          'Yes definitely',
        'My sources say no',          'Do NOT count on it',          'Reply hazy, try again',
        'Cannot predict now',         'Better not tell you now',     'Signs point to yes',
        'As I see it, yes',           'Outlook not so good',         'It is decidedly so',
        'Concentrate and ask again',  'ask again later dickhead',    'its best not to tell u now',
        'yes but ur a skid',          'no you weak fuck',            'indeed my good sir',
        'lmao no but where yo mom at?',                              'nope but add me in other servers'
      ];

      const randomanswers = answers[Math.floor(Math.random() * answers.length)];

      if (!question) {
        return runHelpCommand(message, '8ball');
      }

      message.reply(randomanswers);
    } catch (error) {
      logger.webhook.error(error, message);
      return embeds.deny(message, 'An error occurred while consulting the 8-ball');
    }
  }
}
