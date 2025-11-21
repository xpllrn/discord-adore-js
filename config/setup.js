require('dotenv').config();

// Silent validation - store results for later display
const requiredEnvVars = [
  'BOT_TOKEN',
  'DEV_ID',
  'SERVER_ID',
  'USER_DATABASE',
  'GUILD_DATABASE'
];

const recommendedEnvVars = [
  'CLIENT_ID',
  'ERROR_WEBHOOK_URL',
  'GUILD_WEBHOOK_URL',
  'PREMIUM_ROLE_ID',
  'DEV_ROLE_ID'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
const missingRecommendedVars = recommendedEnvVars.filter(envVar => !process.env[envVar]);

// Export validation results for use in ready event
const validationResults = {
  missingRequired: missingEnvVars,
  missingRecommended: missingRecommendedVars,
  hasErrors: missingEnvVars.length > 0,
  hasWarnings: missingRecommendedVars.length > 0
};

module.exports = {
  // Environment validation results
  validation: validationResults,

  bot: {
    token: process.env.BOT_TOKEN,
    ownerId: process.env.DEV_ID,
    devServerId: process.env.SERVER_ID,
    clientId: process.env.CLIENT_ID,

    defaultPrefix: ',',
    supportServer: 'https://dsc.gg/s-invite',
    inviteLink: `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID || '1427958895250378762'}&permissions=8&integration_type=0&scope=bot+applications.commands`
  },

  database: {
    // Database setup - using USER_DATABASE and GUILD_DATABASE
    userConnection: process.env.USER_DATABASE,
    guildConnection: process.env.GUILD_DATABASE
  },



  apis: {
    lastfm: process.env.LASTFM_API_KEY,
    deepinfra: process.env.DEEP_API
  },

  logging: {
    errorWebhookUrl: process.env.ERROR_WEBHOOK_URL || null,
    guildWebhookUrl: process.env.GUILD_WEBHOOK_URL || null
  },

  // Permission system configuration
  permissions: {
    premiumRoleId: process.env.PREMIUM_ROLE_ID || null,
    devRoleId: process.env.DEV_ROLE_ID || null
  },

  // Colors Configuration
  colors: {
    cooldown: '#a5cae9',
    success: '#51e395',
    error: '#f44336',
    warn: '#f29c1e',
    info: '#e1d4da',
    embed: '#e1d4da',
    spotify: '#1cdc64'
  },

  // Emojis Configuration
  emojis: {
    cooldown: '<:cooldown:1441276341986005126>',
    success: '<:approve:1441260467514511461>',
    error: '<:error:1441260303559032933>',
    warn: '<:warning:1441260398681653381>',
    left: '<:left:1439540967215599768>',
    right: '<:right:1439540986299551775>',
    cancel: '<:cancel:1439546265733173299>',
    choose: '<:skipto:1439540990783258735>',
    loading: '<a:loading:1439560863618175057>',

    lastfm: '<:lastfm:1439540983971840112>',
    join: '<:linked:1431572346216513639>',
    leave: '<:aired:1431572306777604187>',
    cross: '<:deny:1430425037004869682>',
    circle: '<:staff:1430425098657202258>',
    ticket: '🎫',

    // Voice Manager Emojis
    vmLock: '<:lock:1439540969480519721>',
    vmUnlock: '<:unlock:1439541004901548112>',
    vmHide: '<:ghost:1439540961184321536>',
    vmUnhide: '<:unghost:1439541002066202704>',
    vmIncrease: '<:increase:1439540962954055791>',
    vmDecrease: '<:decrease:1439540954607652924>',
    vmInfo: '<:info:1439540965655445606>',
    vmRename: '<:rename:1431572358971261071>',

    // Level Progress Bar Emojis
    blueLeftRounded: '<:blue_left_rounded:1439546259366215680>',
    blue: '<:blue:1439546263669440562>',
    blueRightRounded: '<:blue_right_rounded:1439546261517766747>',
    whiteLeftRounded: '<:white_left_rounded:1439546284414603274>',
    white: '<:white:1439546288562634944>',
    whiteRightRounded: '<:white_right_rounded:1439546286180405289>',

    // Custom Emojis
    google: '<:google:1439546269847650345>',
    spotify: '<:spotify:1433468387824238712>',

    // Rank Emojis
    bronze: '<:bronze:1439546272448118924>',
    silver: '<:silver:1439546277221109841>',
    gold: '<:gold:1439546274960380044>',



  },



};
