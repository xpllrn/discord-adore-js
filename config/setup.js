require('dotenv').config();

// Silent validation - store results for later display
const requiredEnvVars = [
  'BOT_TOKEN',
  'DEV_ID',
  'SERVER_ID',
  'GLOBAL_CONNECTION',
  'LOCAL_CONNECTION'
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
    supportServer: 'https://discord.gg/QT2gZv264Q',
    inviteLink: `https://discord.com/oauth2/authorize?client_id=1427958895250378762&permissions=8&integration_type=0&scope=bot+applications.commands` || '1378983071650680872'}&permissions=8&scope=bot`
  },

  database: {
    // Multi-tenant database setup - using GLOBAL_CONNECTION and LOCAL_CONNECTION
    globalConnection: process.env.GLOBAL_CONNECTION,
    localConnection: process.env.LOCAL_CONNECTION
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
    embed: '#e1d4da'
  },

  // Emojis Configuration
  emojis: {
    cooldown: '<:cooldown:1379296257746538677>',
    success: '<:success:1379289220606070834>',
    error: '<:error:1379296270438371419>',
    warn: '<:warn:1379296346334433316>',
    left: '<:left:1380275840004132864>',
    right: '<:right:1379296316081045595>',
    cancel: '<:cancel:1379296264008634486>',
    choose: '<:choose:1379296334321942690>',
    loading: '<a:loading:1379296276356665364>',
    lastfm: '<:lastfm:1379296282690195496>',
    join: '<:success:1379289220606070834>',
    leave: '<:error:1379296270438371419>',
    cross: '<:x:1382101646598738111>',
    circle: '<:o:1382101649732014080>',
    ticket: '<:Ticket:1385950797895958618>',

    // Voice Manager Emojis
    vmLock: '<:lock:1386222503999049838>',
    vmUnlock: '<:unlock:1386222513490624512>',
    vmHide: '<:hide:1386222497283833876>',
    vmUnhide: '<:unhide:1386222511167115334>',
    vmRename: '<:rename:1386222506322563073>',
    vmClaim: '<:crown:1386222492280029305>',
    vmIncrease: '<:increase:1386222499544563826>',
    vmDecrease: '<:decrease:1386222494729371709>',
    vmDelete: '<:trash:1386222508948062310>',
    vmInfo: '<:infomation:1386222501498978456>',

    // Level Progress Bar Emojis
    blueLeftRounded: '<:blue_left_rounded:1386722842002985082>',
    blue: '<:blue:1386722849007468544>',
    blueRightRounded: '<:blue_right_rounded:1386722855038750892>',
    whiteLeftRounded: '<:white_left_rounded:1386722861833650388>',
    white: '<:white:1386722868062060598>',
    whiteRightRounded: '<:white_right_rounded:1386722874554847293>',

    // Custom Emojis
    naaILovedick: '<:naa_iLovedick:1385809601102090400>',
    google: '<:Google:1385950785975746684>'

  },



};
