/**
 * Backfill Script: Calculate and update late/early leave for existing attendance records
 * 
 * This script:
 * 1. Fetches all attendance records with check_in_time or check_out_time
 * 2. Calculates is_late, late_minutes, is_early_leave, early_leave_minutes
 * 3. Updates the attendance_records table
 * 
 * Usage: node scripts/backfill-attendance-late-early.js [--dry-run] [--limit N]
 */

require("dotenv").config();
const pool = require("../db");
const { calculateAttendanceStatus } = require("../util/attendanceUtil");

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const limitIndex = args.indexOf("--limit");
const limit = limitIndex !== -1 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1], 10) 
  : null;

async function backfillAttendanceRecords() {
  console.log("=".repeat(60));
  console.log("Attendance Late/Early Leave Backfill Script");
  console.log("=".repeat(60));
  console.log(`Mode: ${isDryRun ? "DRY RUN (no changes will be made)" : "LIVE (will update records)"}`);
  if (limit) {
    console.log(`Limit: Processing first ${limit} records`);
  }
  console.log("=".repeat(60));
  console.log();

  let connection;
  try {
    connection = await pool.getConnection();
    
    // Fetch attendance records that need to be updated
    // Only get records that have check_in_time or check_out_time
    let query = `
      SELECT 
        id,
        empid,
        attendance_date,
        check_in_time,
        check_out_time,
        shiftid,
        is_late,
        late_minutes,
        is_early_leave,
        early_leave_minutes
      FROM attendance_records
      WHERE check_in_time IS NOT NULL OR check_out_time IS NOT NULL
      ORDER BY attendance_date DESC, id ASC
    `;
    
    const params = [];
    if (limit) {
      query += " LIMIT ?";
      params.push(limit);
    }

    const [records] = await connection.query(query, params);
    
    console.log(`Found ${records.length} attendance records to process`);
    console.log();

    let processed = 0;
    let updated = 0;
    let errors = 0;
    const stats = {
      late: 0,
      earlyLeave: 0,
      both: 0,
      neither: 0,
    };

    // Process each record
    for (const record of records) {
      try {
        processed++;
        
        // Calculate attendance status
        const attendanceStatus = await calculateAttendanceStatus(
          record.empid,
          record.attendance_date,
          record.check_in_time,
          record.check_out_time,
          record.shiftid
        );

        // Check if update is needed
        const needsUpdate = 
          record.is_late !== attendanceStatus.is_late ||
          record.late_minutes !== attendanceStatus.late_minutes ||
          record.is_early_leave !== attendanceStatus.is_early_leave ||
          record.early_leave_minutes !== attendanceStatus.early_leave_minutes;

        if (needsUpdate) {
          // Update statistics
          if (attendanceStatus.is_late === "Y" && attendanceStatus.is_early_leave === "Y") {
            stats.both++;
          } else if (attendanceStatus.is_late === "Y") {
            stats.late++;
          } else if (attendanceStatus.is_early_leave === "Y") {
            stats.earlyLeave++;
          } else {
            stats.neither++;
          }

          if (!isDryRun) {
            // Update the record
            await connection.query(
              `UPDATE attendance_records 
              SET is_late = ?, 
                  late_minutes = ?, 
                  is_early_leave = ?, 
                  early_leave_minutes = ?,
                  updated_at = NOW()
              WHERE id = ?`,
              [
                attendanceStatus.is_late,
                attendanceStatus.late_minutes,
                attendanceStatus.is_early_leave,
                attendanceStatus.early_leave_minutes,
                record.id,
              ]
            );
          }

          updated++;
          
          // Log progress for every 100 records
          if (updated % 100 === 0) {
            console.log(`Processed ${processed}/${records.length} records, updated ${updated}...`);
          }
        } else {
          stats.neither++;
        }
      } catch (error) {
        errors++;
        console.error(`Error processing record ID ${record.id}:`, error.message);
      }
    }

    // Print summary
    console.log();
    console.log("=".repeat(60));
    console.log("Summary");
    console.log("=".repeat(60));
    console.log(`Total records processed: ${processed}`);
    console.log(`Records updated: ${updated}`);
    console.log(`Errors: ${errors}`);
    console.log();
    console.log("Status breakdown:");
    console.log(`  - Late only: ${stats.late}`);
    console.log(`  - Early leave only: ${stats.earlyLeave}`);
    console.log(`  - Both late and early leave: ${stats.both}`);
    console.log(`  - Neither (on time): ${stats.neither}`);
    console.log("=".repeat(60));

    if (isDryRun) {
      console.log();
      console.log("This was a DRY RUN. No changes were made.");
      console.log("Run without --dry-run to apply changes.");
    }

  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    // Close the pool
    await pool.end();
    process.exit(0);
  }
}

// Run the script
backfillAttendanceRecords().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

