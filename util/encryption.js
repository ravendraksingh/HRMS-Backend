// util/encryption.js
// PII Data Encryption Utility
// Encrypts sensitive PII fields using AES-256-GCM

const crypto = require('crypto');
const logger = require('./logger');

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000; // Key derivation iterations

/**
 * Get encryption key from environment
 * In production, consider using AWS KMS, HashiCorp Vault, or similar
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  // Key should be 64 hex characters (32 bytes = 256 bits)
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (256 bits)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypt PII data
 * @param {string} plaintext - Data to encrypt
 * @returns {string|null} - Encrypted data in format: iv:salt:tag:encryptedData (all base64) or null if input is null/empty
 */
function encryptPII(plaintext) {
  if (!plaintext || plaintext === null || plaintext === '' || plaintext === undefined) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key from master key and salt (PBKDF2)
    const derivedKey = crypto.pbkdf2Sync(key, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');

    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

    let encrypted = cipher.update(String(plaintext), 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const tag = cipher.getAuthTag();

    // Format: iv:salt:tag:encrypted (all base64 encoded)
    const result = [
      iv.toString('base64'),
      salt.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');

    return result;
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Encryption failed');
    throw new Error('Failed to encrypt PII data');
  }
}

/**
 * Decrypt PII data
 * @param {string} encryptedData - Encrypted data in format: iv:salt:tag:encryptedData
 * @returns {string|null} - Decrypted plaintext or null if input is null/empty
 */
function decryptPII(encryptedData) {
  if (!encryptedData || encryptedData === null || encryptedData === '' || encryptedData === undefined) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 4) {
      // If format is incorrect, might be unencrypted (migration scenario)
      logger.warn('Invalid encrypted data format, might be unencrypted');
      return encryptedData; // Return as-is for backward compatibility during migration
    }

    const [ivBase64, saltBase64, tagBase64, encryptedBase64] = parts;

    const iv = Buffer.from(ivBase64, 'base64');
    const salt = Buffer.from(saltBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    // Derive key from master key and salt
    const derivedKey = crypto.pbkdf2Sync(key, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');

    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    // If decryption fails, it might be unencrypted (migration scenario)
    logger.warn({ error: error.message }, 'Decryption failed, might be unencrypted data');
    // Return original value for backward compatibility during migration
    return encryptedData;
  }
}

/**
 * Encrypt multiple PII fields in an object
 * @param {Object} data - Object containing PII fields
 * @param {Array<string>} fieldsToEncrypt - Array of field names to encrypt
 * @returns {Object} - Object with encrypted fields
 */
function encryptPIIFields(data, fieldsToEncrypt) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const encrypted = { ...data };

  for (const field of fieldsToEncrypt) {
    if (encrypted[field] !== undefined && encrypted[field] !== null && encrypted[field] !== '') {
      encrypted[field] = encryptPII(String(encrypted[field]));
    }
  }

  return encrypted;
}

/**
 * Decrypt multiple PII fields in an object
 * @param {Object} data - Object containing encrypted fields
 * @param {Array<string>} fieldsToDecrypt - Array of field names to decrypt
 * @returns {Object} - Object with decrypted fields
 */
function decryptPIIFields(data, fieldsToDecrypt) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const decrypted = { ...data };

  for (const field of fieldsToDecrypt) {
    if (decrypted[field] !== undefined && decrypted[field] !== null && decrypted[field] !== '') {
      try {
        decrypted[field] = decryptPII(decrypted[field]);
      } catch (error) {
        // If decryption fails, keep original value (might be unencrypted during migration)
        logger.warn({ field, error: error.message }, 'Failed to decrypt field, keeping original value');
      }
    }
  }

  return decrypted;
}

/**
 * Check if a value is encrypted (has the expected format)
 * @param {string} value - Value to check
 * @returns {boolean} - True if value appears to be encrypted
 */
function isEncrypted(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const parts = value.split(':');
  return parts.length === 4; // iv:salt:tag:encrypted format
}

module.exports = {
  encryptPII,
  decryptPII,
  encryptPIIFields,
  decryptPIIFields,
  isEncrypted,
};

