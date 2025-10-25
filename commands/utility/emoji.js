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
  aliases: ['emojis', 'emojiarchive'],
  description: "Archive and download all server emojis",
  usage: '{guildprefix}emoji archive',
  permission: 'Manage Emojis',
  run: async(client, message, args) => {

    if (!hasDiscordPermission(message, PermissionFlagsBits.ManageGuildExpressions, 'Manage Emojis and Stickers')) return;

    if (!args[0] || args[0].toLowerCase() !== 'archive') {
      return embeds.info(message, 'Use `,emoji archive` to download all server emojis as a zip file.');
    }

    const guildEmojis = message.guild.emojis.cache;

    if (guildEmojis.size === 0) {
      return embeds.warn(message, 'This server has no custom emojis to archive.');
    }

    // Send loading message
    const loadingEmbed = new EmbedBuilder()
      .setColor(colors.info)
      .setDescription(`${emojis.loading} Archiving **${guildEmojis.size}** emoji${guildEmojis.size === 1 ? '' : 's'}... This may take a moment.`);

    const loadingMessage = await message.channel.send({ embeds: [loadingEmbed] });

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
          const emojiUrl = emoji.url;

          await downloadFile(emojiUrl, filePath);
          downloaded++;
        } catch (error) {
          failed++;
        }
      }

      if (downloaded === 0) {
        // Clean up
        fs.rmSync(tempDir, { recursive: true, force: true });
        await loadingMessage.delete();
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
        await loadingMessage.delete();
        return embeds.deny(message, `The emoji archive is too large (${fileSizeMB.toFixed(2)}MB). Discord's file limit is 25MB.`);
      }

      // Send the zip file
      const attachment = new AttachmentBuilder(zipPath, { 
        name: `${message.guild.name.replace(/[^a-z0-9]/gi, '_')}_emojis.zip` 
      });

      const successEmbed = new EmbedBuilder()
        .setColor(colors.success)
        .setTitle('✅ Emoji Archive Complete')
        .setDescription(`Successfully archived **${downloaded}** emoji${downloaded === 1 ? '' : 's'}${failed > 0 ? `\n⚠️ Failed to download ${failed} emoji${failed === 1 ? '' : 's'}` : ''}`)
        .addFields(
          { name: 'File Size', value: `${fileSizeMB.toFixed(2)} MB`, inline: true },
          { name: 'Format', value: 'ZIP Archive', inline: true }
        )
        .setFooter({ text: `Requested by ${message.author.tag}` })
        .setTimestamp();

      await message.channel.send({ 
        embeds: [successEmbed], 
        files: [attachment] 
      });

      // Clean up
      await loadingMessage.delete();
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.unlinkSync(zipPath);

    } catch (error) {
      console.error('Error archiving emojis:', error);
      await loadingMessage.delete();
      return embeds.deny(message, 'An error occurred while archiving emojis. Please try again.');
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
        fs.unlink(filePath, () => {});
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
