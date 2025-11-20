#!/usr/bin/env node

/**
 * Command Reorganization Migration Script
 * 
 * This script will:
 * 1. Create the new folder structure
 * 2. Move all command files to their new locations
 * 3. Update relative imports in each file
 * 4. Create a backup before starting
 * 5. Generate a migration report
 */

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

// Migration map: old path -> new path
const migrationMap = {
  // CORE (5 files)
  'commands/essentials/help.js': 'commands/core/help.js',
  'commands/essentials/ping.js': 'commands/core/ping.js',
  'commands/essentials/prefix.js': 'commands/core/prefix.js',
  'commands/service/botinfo.js': 'commands/core/botinfo.js',
  'commands/service/invite.js': 'commands/core/invite.js',

  // MODERATION (20 files) - most already in place
  'commands/purge/purge.js': 'commands/moderation/purge/purge.js',
  'commands/purge/cleanup.js': 'commands/moderation/purge/cleanup.js',

  // FUN/ECONOMY (43 files)
  'commands/gamble/bal.js': 'commands/fun/economy/balance/bal.js',
  'commands/gamble/deposit.js': 'commands/fun/economy/balance/deposit.js',
  'commands/gamble/withdraw.js': 'commands/fun/economy/balance/withdraw.js',
  'commands/gamble/transfer.js': 'commands/fun/economy/balance/transfer.js',
  'commands/gamble/leaderboard.js': 'commands/fun/economy/balance/leaderboard.js',
  'commands/gamble/daily.js': 'commands/fun/economy/earning/daily.js',
  'commands/gamble/crime.js': 'commands/fun/economy/earning/crime.js',
  'commands/gamble/slut.js': 'commands/fun/economy/earning/slut.js',
  'commands/gamble/rob.js': 'commands/fun/economy/earning/rob.js',
  'commands/gamble/pray.js': 'commands/fun/economy/earning/pray.js',
  'commands/gamble/curse.js': 'commands/fun/economy/earning/curse.js',
  'commands/gamble/pick.js': 'commands/fun/economy/earning/pick.js',
  'commands/gamble/vote.js': 'commands/fun/economy/earning/vote.js',
  'commands/gamble/coinflip.js': 'commands/fun/economy/gambling/coinflip.js',
  'commands/gamble/slot.js': 'commands/fun/economy/gambling/slot.js',
  'commands/gamble/ttt.js': 'commands/fun/economy/gambling/ttt.js',
  'commands/gamble/store.js': 'commands/fun/economy/shop/store.js',
  'commands/gamble/buy.js': 'commands/fun/economy/shop/buy.js',
  'commands/gamble/sell.js': 'commands/fun/economy/shop/sell.js',
  'commands/gamble/use.js': 'commands/fun/economy/shop/use.js',
  'commands/gamble/inventory.js': 'commands/fun/economy/shop/inventory.js',
  'commands/gamble/store/_index.js': 'commands/fun/economy/shop/_index.js',
  'commands/gamble/store/items.js': 'commands/fun/economy/shop/items.js',
  'commands/gamble/marry.js': 'commands/fun/economy/marriage/marry.js',
  'commands/gamble/divorce.js': 'commands/fun/economy/marriage/divorce.js',
  'commands/gamble/married.js': 'commands/fun/economy/marriage/married.js',
  'commands/gamble/edaters.js': 'commands/fun/economy/marriage/edaters.js',
  'commands/fun/rps.js': 'commands/fun/games/rps.js',
  'commands/miscellaneous/8ball.js': 'commands/fun/games/8ball.js',
  'commands/miscellaneous/advice.js': 'commands/fun/random/advice.js',
  'commands/miscellaneous/yomama.js': 'commands/fun/random/yomama.js',
  'commands/miscellaneous/quote.js': 'commands/fun/random/quote.js',
  'commands/fun/blacktea.js': 'commands/fun/random/blacktea.js',
  'commands/miscellaneous/define.js': 'commands/fun/search/define.js',
  'commands/miscellaneous/urban.js': 'commands/fun/search/urban.js',
  'commands/miscellaneous/youtube.js': 'commands/fun/search/youtube.js',
  'commands/miscellaneous/img.js': 'commands/fun/search/img.js',

  // PROFILES (16 files)
  'commands/server/profiles/avatar.js': 'commands/profiles/user/avatar.js',
  'commands/server/profiles/banner.js': 'commands/profiles/user/banner.js',
  'commands/server/profiles/savatar.js': 'commands/profiles/user/savatar.js',
  'commands/server/profiles/sbanner.js': 'commands/profiles/user/sbanner.js',
  'commands/information/userinfo.js': 'commands/profiles/user/userinfo.js',
  'commands/server/profiles/guildicon.js': 'commands/profiles/server/guildicon.js',
  'commands/server/profiles/guildbanner.js': 'commands/profiles/server/guildbanner.js',
  'commands/server/profiles/guildsplash.js': 'commands/profiles/server/guildsplash.js',
  'commands/server/theme/seticon.js': 'commands/profiles/server/seticon.js',
  'commands/server/theme/setbanner.js': 'commands/profiles/server/setbanner.js',
  'commands/server/theme/setsplash.js': 'commands/profiles/server/setsplash.js',
  'commands/utility/emoji.js': 'commands/profiles/expressions/emoji.js',
  'commands/utility/enlarge.js': 'commands/profiles/expressions/enlarge.js',
  'commands/utility/sticker.js': 'commands/profiles/expressions/sticker.js',
  'commands/server/steal/steal.js': 'commands/profiles/expressions/steal.js',
  'commands/server/steal/sticker.js': 'commands/profiles/expressions/stealsticker.js',

  // INFORMATION (7 files)
  'commands/information/afk.js': 'commands/information/user/afk.js',
  'commands/information/birthday.js': 'commands/information/user/birthday.js',
  'commands/information/timezone.js': 'commands/information/user/timezone.js',
  'commands/information/names.js': 'commands/information/history/names.js',
  'commands/information/servernames.js': 'commands/information/history/servernames.js',
  'commands/information/guildnamehistory.js': 'commands/information/history/guildnamehistory.js',

  // SERVER (40+ files)
  'commands/server/autoroles/autorole.js': 'commands/server/roles/autorole.js',
  'commands/server/autoroles/buttonrole.js': 'commands/server/roles/buttonrole.js',
  'commands/server/autoroles/reactionrole.js': 'commands/server/roles/reactionrole.js',
  'commands/server/boostrole.js': 'commands/server/roles/boostrole.js',
  'commands/server/channel/lock.js': 'commands/server/channels/lock.js',
  'commands/server/channel/unlock.js': 'commands/server/channels/unlock.js',
  'commands/server/channel/hide.js': 'commands/server/channels/hide.js',
  'commands/server/channel/unhide.js': 'commands/server/channels/unhide.js',
  'commands/server/channel/pin.js': 'commands/server/channels/pin.js',
  'commands/server/channel/topic.js': 'commands/server/channels/topic.js',
  'commands/server/channel/firstmessage.js': 'commands/server/channels/firstmessage.js',
  'commands/server/channel/naughty.js': 'commands/server/channels/naughty.js',
  'commands/server/names/forcenick.js': 'commands/server/members/forcenick.js',
  'commands/server/names/rename.js': 'commands/server/members/rename.js',
  'commands/server/boost.js': 'commands/server/boost/boost.js',
  'commands/server/boostlost.js': 'commands/server/boost/boostlost.js',
  'commands/server/autoreact.js': 'commands/server/automation/autoreact.js',
  'commands/server/autoresponder.js': 'commands/server/automation/autoresponder.js',
  'commands/server/alias.js': 'commands/server/automation/alias.js',
  'commands/server/message.js': 'commands/server/automation/message.js',
  'commands/server/confession.js': 'commands/server/features/confession.js',
  'commands/server/ticket.js': 'commands/server/features/ticket.js',
  'commands/server/starboard.js': 'commands/server/features/starboard.js',
  'commands/server/voicemaster.js': 'commands/server/features/voicemaster.js',
  'commands/server/giveaways.js': 'commands/server/features/giveaways.js',
  'commands/server/vanity.js': 'commands/server/features/vanity.js',
  'commands/server/welcome.js': 'commands/server/events/welcome.js',
  'commands/server/leave.js': 'commands/server/events/leave.js',
  'commands/server/settings.js': 'commands/server/settings/settings.js',
  'commands/server/logs.js': 'commands/server/settings/logs.js',
  'commands/server/customize.js': 'commands/server/settings/customize.js',
  'commands/server/webhook.js': 'commands/server/settings/webhook.js',
  'commands/antinuke/antinuke.js': 'commands/server/antinuke/antinuke.js',

  // MUSIC (2 files)
  'commands/spotify/spotify.js': 'commands/music/spotify/spotify.js',
  'commands/lastfm/fm.js': 'commands/music/lastfm/fm.js',

  // SOCIAL (2 files)
  'commands/socials/tiktok.js': 'commands/social/tiktok.js',
  'commands/socials/valorant.js': 'commands/social/valorant.js',

  // UTILITY (15 files)
  'commands/miscellaneous/say.js': 'commands/utility/messages/say.js',
  'commands/utility/responder.js': 'commands/utility/messages/responder.js',
  'commands/essentials/copyembed.js': 'commands/utility/embeds/copyembed.js',
  'commands/essentials/createembed.js': 'commands/utility/embeds/createembed.js',
  'commands/snipes/snipe.js': 'commands/utility/snipes/snipe.js',
  'commands/snipes/editsnipe.js': 'commands/utility/snipes/editsnipe.js',
  'commands/snipes/reactionsnipe.js': 'commands/utility/snipes/reactionsnipe.js',
  'commands/snipes/clearsnipe.js': 'commands/utility/snipes/clearsnipe.js',
  'commands/utility/translate.js': 'commands/utility/tools/translate.js',
  'commands/utility/remind.js': 'commands/utility/tools/remind.js',
  'commands/utility/count.js': 'commands/utility/tools/count.js',
  'commands/service/note.js': 'commands/utility/tools/note.js',
  'commands/service/swear.js': 'commands/utility/tools/swear.js',
  'commands/miscellaneous/sprint.js': 'commands/utility/misc/sprint.js',

  // PREMIUM (4 files)
  'commands/premium/ask.js': 'commands/premium/ai/ask.js',
  'commands/premium/askvm.js': 'commands/premium/ai/askvm.js',
  'commands/premium/tts.js': 'commands/premium/voice/tts.js',

  // DEV (5 files)
  'commands/dev/blacklist.js': 'commands/dev/admin/blacklist.js',
  'commands/dev/clear.js': 'commands/dev/admin/clear.js',
  'commands/dev/eco.js': 'commands/dev/admin/eco.js',
  'commands/dev/restart.js': 'commands/dev/admin/restart.js',
  'commands/dev/fetch.js': 'commands/dev/admin/fetch.js',
};

// Import path mappings for updating requires
const importDepthMap = {
  'config/setup': true,
  'core/embeds': true,
  'core/buttons': true,
  'handlers/finder': true,
  'database': true,
  'database/services': true,
  'utils/': true,
};

let stats = {
  moved: 0,
  failed: 0,
  updated: 0,
  errors: []
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createBackup() {
  log('\n📦 Creating backup...', 'cyan');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `backup-commands-${timestamp}`;
  
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    copyDir('commands', path.join(backupDir, 'commands'));
    if (fs.existsSync('commandSlash')) {
      copyDir('commandSlash', path.join(backupDir, 'commandSlash'));
    }
    log(`✅ Backup created: ${backupDir}`, 'green');
    return backupDir;
  } catch (error) {
    log(`❌ Backup failed: ${error.message}`, 'red');
    throw error;
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function calculateNewImportPath(oldFilePath, newFilePath, importPath) {
  // Skip if it's a module alias (starts with @)
  if (importPath.startsWith('@')) {
    return importPath;
  }
  
  // Skip if it's not a relative import
  if (!importPath.startsWith('.')) {
    return importPath;
  }
  
  // Calculate the absolute path of the import from old location
  const oldDir = path.dirname(oldFilePath);
  const absoluteImportPath = path.resolve(oldDir, importPath);
  
  // Calculate relative path from new location
  const newDir = path.dirname(newFilePath);
  let newRelativePath = path.relative(newDir, absoluteImportPath);
  
  // Ensure it starts with ./
  if (!newRelativePath.startsWith('.')) {
    newRelativePath = './' + newRelativePath;
  }
  
  // Convert Windows paths to Unix
  newRelativePath = newRelativePath.replace(/\\/g, '/');
  
  return newRelativePath;
}

function updateImports(content, oldPath, newPath) {
  // Match require statements
  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
  
  let updatedContent = content.replace(requireRegex, (match, importPath) => {
    const newImportPath = calculateNewImportPath(oldPath, newPath, importPath);
    if (newImportPath !== importPath) {
      stats.updated++;
      return `require('${newImportPath}')`;
    }
    return match;
  });
  
  return updatedContent;
}

function moveFile(oldPath, newPath) {
  try {
    // Check if source exists
    if (!fs.existsSync(oldPath)) {
      log(`⚠️  Source not found: ${oldPath}`, 'yellow');
      return false;
    }
    
    // Create destination directory
    const newDir = path.dirname(newPath);
    fs.mkdirSync(newDir, { recursive: true });
    
    // Read file content
    let content = fs.readFileSync(oldPath, 'utf8');
    
    // Update imports
    content = updateImports(content, oldPath, newPath);
    
    // Write to new location
    fs.writeFileSync(newPath, content, 'utf8');
    
    // Delete old file
    fs.unlinkSync(oldPath);
    
    stats.moved++;
    log(`✓ ${oldPath} → ${newPath}`, 'green');
    return true;
  } catch (error) {
    stats.failed++;
    stats.errors.push({ file: oldPath, error: error.message });
    log(`✗ Failed: ${oldPath} - ${error.message}`, 'red');
    return false;
  }
}

function cleanupEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  // Recursively clean subdirectories first
  for (const entry of entries) {
    if (entry.isDirectory()) {
      cleanupEmptyDirs(path.join(dir, entry.name));
    }
  }
  
  // Check if directory is now empty
  const remainingEntries = fs.readdirSync(dir);
  if (remainingEntries.length === 0) {
    fs.rmdirSync(dir);
    log(`🗑️  Removed empty directory: ${dir}`, 'yellow');
  }
}

function generateReport() {
  log('\n' + '='.repeat(80), 'cyan');
  log('MIGRATION REPORT', 'bright');
  log('='.repeat(80), 'cyan');
  log(`\n✅ Files moved: ${stats.moved}`, 'green');
  log(`❌ Files failed: ${stats.failed}`, stats.failed > 0 ? 'red' : 'green');
  log(`🔄 Imports updated: ${stats.updated}`, 'cyan');
  
  if (stats.errors.length > 0) {
    log('\n❌ Errors:', 'red');
    stats.errors.forEach(({ file, error }) => {
      log(`  - ${file}: ${error}`, 'red');
    });
  }
  
  log('\n' + '='.repeat(80), 'cyan');
}

async function main() {
  log('='.repeat(80), 'bright');
  log('COMMAND REORGANIZATION MIGRATION', 'bright');
  log('='.repeat(80), 'bright');
  
  log('\n⚠️  This will reorganize your command structure!', 'yellow');
  log('A backup will be created automatically.\n', 'yellow');
  
  // Create backup
  const backupDir = createBackup();
  
  // Start migration
  log('\n🚀 Starting migration...', 'cyan');
  log(`📝 Migrating ${Object.keys(migrationMap).length} files\n`, 'cyan');
  
  // Move files
  for (const [oldPath, newPath] of Object.entries(migrationMap)) {
    moveFile(oldPath, newPath);
  }
  
  // Cleanup empty directories
  log('\n🧹 Cleaning up empty directories...', 'cyan');
  cleanupEmptyDirs('commands');
  
  // Generate report
  generateReport();
  
  log('\n✨ Migration complete!', 'green');
  log(`📦 Backup saved to: ${backupDir}`, 'cyan');
  log('\n💡 Next steps:', 'cyan');
  log('  1. Test your bot to ensure all commands work', 'reset');
  log('  2. Check the help command categories', 'reset');
  log('  3. If everything works, you can delete the backup folder', 'reset');
  log('  4. If issues occur, restore from backup', 'reset');
}

// Run migration
main().catch(error => {
  log(`\n❌ Migration failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
