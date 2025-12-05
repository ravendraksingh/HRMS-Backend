// scripts/migrate-encrypt-pii.js
// Migration script to encrypt existing PII data (PAN, Aadhaar, Passport, DL)
// Run this script after deploying the encryption utility

require('dotenv').config();
const pool = require('../db');
const { encryptPIIFields, isEncrypted } = require('../util/encryption');
const { PII_FIELDS } = require('../config/piiFields');
const logger = require('../util/logger');

/**
 * Migrate employee personal details - encrypt existing PII data
 */
async function migrateEmployeePersonalDetails() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Get all records that might need encryption
    const [records] = await connection.query(
      `SELECT empid, pan_number, aadhaar_number, passport_number, driving_license_number
       FROM employee_personal_details
       WHERE pan_number IS NOT NULL 
          OR aadhaar_number IS NOT NULL 
          OR passport_number IS NOT NULL 
          OR driving_license_number IS NOT NULL`
    );

    logger.info({ count: records.length }, 'Starting employee personal details PII encryption migration');

    let encryptedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      const fieldsToCheck = PII_FIELDS.employee_personal_details;
      let needsEncryption = false;
      const updateData = {};

      // Check each field - encrypt if not already encrypted
      for (const field of fieldsToCheck) {
        const value = record[field];
        if (value && !isEncrypted(value)) {
          needsEncryption = true;
          updateData[field] = value;
        }
      }

      if (needsEncryption) {
        // Encrypt the fields that need encryption
        const encrypted = encryptPIIFields(updateData, fieldsToCheck);

        // Build update query
        const updates = [];
        const params = [];

        if (encrypted.pan_number !== undefined) {
          updates.push('pan_number = ?');
          params.push(encrypted.pan_number);
        }
        if (encrypted.aadhaar_number !== undefined) {
          updates.push('aadhaar_number = ?');
          params.push(encrypted.aadhaar_number);
        }
        if (encrypted.passport_number !== undefined) {
          updates.push('passport_number = ?');
          params.push(encrypted.passport_number);
        }
        if (encrypted.driving_license_number !== undefined) {
          updates.push('driving_license_number = ?');
          params.push(encrypted.driving_license_number);
        }

        // Set encryption version
        updates.push('encryption_version = 1');
        
        // Add empid at the end for WHERE clause
        params.push(record.empid);

        await connection.query(
          `UPDATE employee_personal_details SET ${updates.join(', ')} WHERE empid = ?`,
          params
        );

        encryptedCount++;
        logger.debug({ empid: record.empid }, 'Encrypted employee personal details');
      } else {
        skippedCount++;
      }
    }

    await connection.commit();
    logger.info(
      { 
        total: records.length, 
        encrypted: encryptedCount, 
        skipped: skippedCount 
      }, 
      'Employee personal details PII encryption migration completed'
    );

    return { total: records.length, encrypted: encryptedCount, skipped: skippedCount };
  } catch (error) {
    await connection.rollback();
    logger.error({ error: error.message, stack: error.stack }, 'Employee personal details migration failed');
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Migrate employee family dependents - encrypt existing PII data
 */
async function migrateEmployeeFamilyDependents() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Get all records that might need encryption
    const [records] = await connection.query(
      `SELECT id, empid, aadhaar_number, pan_number, passport_number
       FROM employee_family_dependents
       WHERE aadhaar_number IS NOT NULL 
          OR pan_number IS NOT NULL 
          OR passport_number IS NOT NULL`
    );

    logger.info({ count: records.length }, 'Starting employee family dependents PII encryption migration');

    let encryptedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      const fieldsToCheck = PII_FIELDS.employee_family_dependents;
      let needsEncryption = false;
      const updateData = {};

      // Check each field - encrypt if not already encrypted
      for (const field of fieldsToCheck) {
        const value = record[field];
        if (value && !isEncrypted(value)) {
          needsEncryption = true;
          updateData[field] = value;
        }
      }

      if (needsEncryption) {
        // Encrypt the fields that need encryption
        const encrypted = encryptPIIFields(updateData, fieldsToCheck);

        // Build update query
        const updates = [];
        const params = [];

        if (encrypted.aadhaar_number !== undefined) {
          updates.push('aadhaar_number = ?');
          params.push(encrypted.aadhaar_number);
        }
        if (encrypted.pan_number !== undefined) {
          updates.push('pan_number = ?');
          params.push(encrypted.pan_number);
        }
        if (encrypted.passport_number !== undefined) {
          updates.push('passport_number = ?');
          params.push(encrypted.passport_number);
        }

        // Set encryption version
        updates.push('encryption_version = 1');
        
        // Add id at the end for WHERE clause
        params.push(record.id);

        await connection.query(
          `UPDATE employee_family_dependents SET ${updates.join(', ')} WHERE id = ?`,
          params
        );

        encryptedCount++;
        logger.debug({ id: record.id, empid: record.empid }, 'Encrypted family dependent details');
      } else {
        skippedCount++;
      }
    }

    await connection.commit();
    logger.info(
      { 
        total: records.length, 
        encrypted: encryptedCount, 
        skipped: skippedCount 
      }, 
      'Employee family dependents PII encryption migration completed'
    );

    return { total: records.length, encrypted: encryptedCount, skipped: skippedCount };
  } catch (error) {
    await connection.rollback();
    logger.error({ error: error.message, stack: error.stack }, 'Employee family dependents migration failed');
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Main migration function
 */
async function migrateEncryptPII() {
  try {
    logger.info('Starting PII encryption migration...');

    // Check if encryption key is set
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Migrate employee personal details
    const personalDetailsResult = await migrateEmployeePersonalDetails();

    // Migrate employee family dependents
    const familyDependentsResult = await migrateEmployeeFamilyDependents();

    logger.info(
      {
        personalDetails: personalDetailsResult,
        familyDependents: familyDependentsResult,
      },
      'PII encryption migration completed successfully'
    );

    console.log('\n✅ Migration Summary:');
    console.log('Employee Personal Details:');
    console.log(`  - Total records: ${personalDetailsResult.total}`);
    console.log(`  - Encrypted: ${personalDetailsResult.encrypted}`);
    console.log(`  - Skipped (already encrypted): ${personalDetailsResult.skipped}`);
    console.log('\nEmployee Family Dependents:');
    console.log(`  - Total records: ${familyDependentsResult.total}`);
    console.log(`  - Encrypted: ${familyDependentsResult.encrypted}`);
    console.log(`  - Skipped (already encrypted): ${familyDependentsResult.skipped}`);

    process.exit(0);
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Migration failed');
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateEncryptPII();
}

module.exports = {
  migrateEncryptPII,
  migrateEmployeePersonalDetails,
  migrateEmployeeFamilyDependents,
};

