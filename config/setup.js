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
    cooldown: '#a5eb78',
    success: '#a4ec7c',
    error: '#fc6464',
    warn: '#fbd03b',
    info: '#e1d4da',
    embed: '#e1d4da',
    spotify: '#1cdc64'
  },

  // Emojis Configuration
  emojis: {
    cooldown: '<:cooldown:1431572324104278109>',
    success: '<:approve:1431572311827288154>',
    error: '<:deny:1431572328298450994>',
    warn: '<:warning:1431572385726988388>',
    left: '<:left:1431572343976624209>',
    right: '<:right:1431572361399894016>',
    cancel: '<:cancel:1431572321893613649>',
    choose: '<:skipto:1431572370019188816>',
    loading: '<a:loading:1431572348489699361>',

    lastfm: '<:lastfm:1431572342018019348>',
    join: '<:linked:1431572346216513639>',
    leave: '<:aired:1431572306777604187>',
    cross: '<:deny:1430425037004869682>',
    circle: '<:staff:1430425098657202258>',
    ticket: '🎫',

    // Voice Manager Emojis
    vmLock: '<:lock:1431572351799132302>',
    vmUnlock: '<:unlock:1431572383118135316>',
    vmHide: '<:ghost:1431572330345402419>',
    vmUnhide: '<:unghost:1431572381322969178>',
    vmIncrease: '<:increase:1431572334854279168>',
    vmDecrease: '<:decrease:1431572326088183911>',
    vmInfo: '<:info:1431572339354632193>',
    vmRename: '<:rename:1431572358971261071>',

    // Level Progress Bar Emojis
    blueLeftRounded: '<:blue_left_rounded:1431572315283525753>',
    blue: '<:blue:1431572319595401266>',
    blueRightRounded: '<:blue_right_rounded:1431572317359702188>',
    whiteLeftRounded: '<:white_left_rounded:1431572393440186459>',
    white: '<:white:1431572397341020243>',
    whiteRightRounded: '<:white_right_rounded:1431572395340075028>',

    // Custom Emojis
    google: '<:google:1431572332832489533>',
    spotify: '<:spotify:1433468387824238712>',

    // Spotify Control Emojis
    spotifyPlay: '<:play:1432294396828848170>',
    spotifyPause: '<:pause:1432294414457376848>',
    spotifyPrevious: '<:previous:1432294387009851402>',
    spotifyNext: '<:next:1432294327727554570>',
    spotifyVolume: '<:volume:1432294374846496908>',
    spotifyQueue: '<:queue:1432294322388074516>',
    spotifyQueueAdd: '<:queueadd:1432294384799449170>',
    spotifyRepeat: '<:repeat:1432294357465042944>',
    spotifyShuffle: '<:shuffle:1432294336917143663>',
    spotifyShare: '<:share:1432294350250971136>',
    musicNote: '<:play:1432294396828848170>',



  },



};
