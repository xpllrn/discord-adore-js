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
    supportServer: 'https://dsc.gg/s-invite',
    inviteLink: `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID || '1427958895250378762'}&permissions=8&integration_type=0&scope=bot+applications.commands`
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
    vmLock: '<:lock:1430503055752953887>',
    vmUnlock: '<:unlock:1430503064808198184>',
    vmHide: '<:ghost:1430503073565900961>',
    vmUnhide: '<:unghost:1430503081925279754>',
    vmIncrease: '<:increase:1430503123159482544>',
    vmDecrease: '<:decrease:1430503131346895001>',
    vmInfo: '<:info:1430503114879799356>',
    vmRename: '<:rename:1431402284386091121>',

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

    // Uno Card Emojis - Green Cards
    unoGreen0: '<:UnoGreen0:1434121642870702080>',
    unoGreen1: '<:UnoGreen1:1434121666706931782>',
    unoGreen2: '<:UnoGreen2:1434121635463565424>',
    unoGreen3: '<:UnoGreen3:1434121639108411456>',
    unoGreen4: '<:UnoGreen4:1434121644917526588>',
    unoGreen5: '<:UnoGreen5:1434121647274590240>',
    unoGreen6: '<:UnoGreen6:1434121650332500020>',
    unoGreen7: '<:UnoGreen7:1434121652710408283>',
    unoGreen8: '<:UnoGreen8:1434121654816079913>',
    unoGreen9: '<:UnoGreen9:1434121657454432256>',
    unoGreen10: '<:UnoGreen10:1434121662340796427>',
    unoGreen11: '<:UnoGreen11:1434121659807436862>',
    unoGreen12: '<:UnoGreen12:1434121664358252626>',

    // Uno Card Emojis - Blue Cards
    unoBlue0: '<:UnoBlue0:1434122961622798446>',
    unoBlue1: '<:UnoBlue1:1434122933562904657>',
    unoBlue2: '<:UnoBlue2:1434122936536531074>',
    unoBlue3: '<:UnoBlue3:1434122941142012015>',
    unoBlue4: '<:UnoBlue4:1434122938700923073>',
    unoBlue5: '<:UnoBlue5:1434122943142559826>',
    unoBlue6: '<:UnoBlue6:1434122945600684032>',
    unoBlue7: '<:UnoBlue7:1434122947957886996>',
    unoBlue8: '<:UnoBlue8:1434122950055039016>',
    unoBlue9: '<:UnoBlue9:1434122951925432383>',
    unoBlue10: '<:UnoBlue10:1434122959144095765>',
    unoBlue11: '<:UnoBlue11:1434122956593823744>',
    unoBlue12: '<:UnoBlue12:1434122953867526276>',

    // Uno Card Emojis - Red Cards
    unoRed0: '<:UnoRed0:1434123896772231369>',
    unoRed1: '<:UnoRed1:1434123858868437035>',
    unoRed2: '<:UnoRed2:1434123863557410917>',
    unoRed3: '<:UnoRed3:1434123866581635133>',
    unoRed4: '<:UnoRed4:1434123870503436410>',
    unoRed5: '<:UnoRed5:1434123873468678245>',
    unoRed6: '<:UnoRed6:1434123876849160262>',
    unoRed7: '<:UnoRed7:1434123879718064230>',
    unoRed8: '<:UnoRed8:1434123889834987611>',
    unoRed9: '<:UnoRed9:1434123882125594664>',
    unoRed10: '<:UnoRed10:1434124269889130547>',
    unoRed11: '<:UnoRed11:1434123898806337556>',
    unoRed12: '<:UnoRed12:1434123861456064562>',

    // Uno Card Emojis - Yellow Cards
    unoYellow0: '<:UnoYellow0:1434124383101780120>',
    unoYellow1: '<:UnoYellow1:1434124387358998550>',
    unoYellow2: '<:UnoYellow2:1434124353108180992>',
    unoYellow3: '<:UnoYellow3:1434124357503811805>',
    unoYellow4: '<:UnoYellow4:1434124359751962674>',
    unoYellow5: '<:UnoYellow5:1434124361710833786>',
    unoYellow6: '<:UnoYellow6:1434124371185766472>',
    unoYellow7: '<:UnoYellow7:1434124373425520640>',
    unoYellow8: '<:UnoYellow8:1434124375728197632>',
    unoYellow9: '<:UnoYellow9:1434124377972146307>',
    unoYellow10: '<:UnoYellow10:1434124380379811895>',
    unoYellow11: '<:UnoYellow11:1434124385400258640>',
    unoYellow12: '<:UnoYellow12:1434124355184627814>',

    // Uno Special Cards
    unoWildDrawFour: '<:UnoPlus4:1434125481124560906>',
    unoInformation: '<:UnoInfomation:1434125464770838598>'

  },



};
