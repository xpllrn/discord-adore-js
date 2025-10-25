const { PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { hasDiscordPermission } = require('../../utils/permissions');
const { embeds } = require('../../core/embeds');
const { colors, emojis } = require('../../config/setup');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

module.exports = {
  name: "emoji",
  aliases: ['emote'],
  description: "Archive and download all server emojis",
  usage: '{guildprefix}emoji archive - Download them all as ZIP\n{guildprefix}emoji list',
  permission: 'Manage Emojis',
  run: async (client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuildExpressions, 'Manage Emojis and Stickers')) return;

    const subcommand = args[0]?.toLowerCase();

    // List subcommand
    if (subcommand === 'list') {
      const guildEmojis = message.guild.emojis.cache;

      if (guildEmojis.size === 0) {
        return embeds.warn(message, 'This server has no custom emojis.');
      }

      // Convert to array for pagination
      const emojiArray = Array.from(guildEmojis.values());

      // Format page function for pagination
      const formatPage = (pageEmojis, currentPage, totalPages) => {
        const startIndex = (currentPage - 1) * 10;

        const emojiList = pageEmojis.map((emoji, index) => {
          const number = (startIndex + index + 1).toString().padStart(2, '0');
          const emojiUrl = emoji.imageURL();
          return `\`${number}\` ${emoji} **[\`${emoji.name}\`](${emojiUrl})**`;
        }).join('\n');

        return new EmbedBuilder()
          .setColor(colors.info)
          .setTitle(`${message.guild.name} Emojis`)
          .setDescription(emojiList)
          .setFooter({ text: `${guildEmojis.size} emoji${guildEmojis.size === 1 ? '' : 's'} || page ${currentPage}/${totalPages}` });
      };

      // Use pagination system with 10 items per page
      const { createPagination } = require('../../core/buttons');
      return await createPagination(message, emojiArray, formatPage, 10, `${message.guild.name} Emojis`);
    }

    // Archive subcommand
    if (subcommand !== 'archive') {
      return embeds.info(message, 'Available subcommands:\n• `,emoji archive` - Download all server emojis as a zip file\n• `,emoji list` - Show all server emojis');
    }

    const guildEmojis = message.guild.emojis.cache;

    if (guildEmojis.size === 0) {
      return embeds.warn(message, 'This server has no custom emojis to archive.');
    }

    // Send loading message
    const loadingMessage = await embeds.loading(message, `Please wait, I'm archiving **${guildEmojis.size} emoji${guildEmojis.size === 1 ? '' : 's'}** for you`);

    try {
      // Create temporary directory for emojis
      const tempDir = path.join(__dirname, '../../temp', `emojis_${message.guild.id}_${Date.now()}`);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Download all emojis
      let downloaded = 0;
      let failed = 0;

      for (const [id, emoji] of guildEmojis) {
        try {
          const extension = emoji.animated ? 'gif' : 'png';
          const fileName = `${emoji.name}.${extension}`;
          const filePath = path.join(tempDir, fileName);
          const emojiUrl = emoji.imageURL();

          await downloadFile(emojiUrl, filePath);
          downloaded++;
        } catch (error) {
          console.error(`Failed to download emoji ${emoji.name}:`, error.message);
          failed++;
        }
      }

      if (downloaded === 0) {
        // Clean up
        fs.rmSync(tempDir, { recursive: true, force: true });
        return embeds.deny(message, 'Failed to download any emojis. Please try again.');
      }

      // Create zip file
      const zipPath = path.join(__dirname, '../../temp', `${message.guild.name.replace(/[^a-z0-9]/gi, '_')}_emojis.zip`);
      await createZipArchive(tempDir, zipPath);

      // Check file size (Discord has 25MB limit for non-nitro)
      const stats = fs.statSync(zipPath);
      const fileSizeMB = stats.size / (1024 * 1024);

      if (fileSizeMB > 25) {
        // Clean up
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
        return embeds.deny(message, `The emoji archive is too large (${fileSizeMB.toFixed(2)}MB). Discord's file limit is 25MB.`);
      }

      // Send the zip file
      const attachment = new AttachmentBuilder(zipPath, {
        name: `${message.guild.name.replace(/[^a-z0-9]/gi, '_')}_emojis.zip`
      });

      await message.channel.send({
        files: [attachment]
      });

      // Update loading message to success
      await embeds.approve(loadingMessage, `Successfully archived all **${downloaded}** emoji${downloaded === 1 ? '' : 's'}${failed > 0 ? ` (${failed} failed)` : ''} and sent`);

      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.unlinkSync(zipPath);

    } catch (error) {
      console.error('Error archiving emojis:', error);

      // Log detailed error information
      if (message.client?.errorLogger) {
        message.client.errorLogger.log(error, 'Emoji Archive', {
          command: 'emoji archive',
          args: args.join(' '),
          user: message.author,
          guild: message.guild,
          emojiCount: guildEmojis.size
        });
      }

      // Clean up any temporary files
      try {
        const tempDir = path.join(__dirname, '../../temp', `emojis_${message.guild.id}_${Date.now()}`);
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error('Error cleaning up temp files:', cleanupError);
      }

      return embeds.deny(message, `An error occurred while archiving emojis: ${error.message}\n\nPlease check the logs for more details.`);
    }
  }
};

/**
 * Download a file from URL
 * @param {string} url - File URL
 * @param {string} filePath - Destination file path
 * @returns {Promise<void>}
 */
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(filePath, () => { });
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Create a zip archive from a directory
 * @param {string} sourceDir - Source directory
 * @param {string} outputPath - Output zip file path
 * @returns {Promise<void>}
 */
function createZipArchive(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
