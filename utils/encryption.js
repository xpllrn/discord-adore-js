const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.SPOTIFY_ENCRYPTION_KEY; // Must be 32 bytes (64 hex characters)
const IV_LENGTH = 16; // AES block size

/**
 * Encrypt text using AES-256-CBC
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted text in format: iv:encryptedData
 */
function encrypt(text) {
  if (!text) return null;
  
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error('SPOTIFY_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt text using AES-256-CBC
 * @param {string} text - Encrypted text in format: iv:encryptedData
 * @returns {string} Decrypted plain text
 */
function decrypt(text) {
  if (!text) return null;
  
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error('SPOTIFY_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }

  const parts = text.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate a cryptographically secure random state token
 * @returns {string} 64-character hex string
 */
function generateStateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a secure API key
 * @returns {string} 64-character hex string
 */
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  encrypt,
  decrypt,
  generateStateToken,
  generateApiKey
};
