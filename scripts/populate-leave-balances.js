#!/usr/bin/env node
/**
 * Script to populate leave_balances table
 * 
 * This script:
 * 1. Gets all employees
 * 2. Gets all active leave types
 * 3. Creates leave_balance records for each employee-leave type combination
 * 4. Sets initial values based on leave type max_leaves_per_year
 * 5. Calculates used_leaves from existing approved leaves
 * 
 * Usage: node scripts/populate-leave-balances.js [year]
 * If year is not provided, uses current year
 */

require("dotenv").config();
const pool = require("../db");

async function populateLeaveBalances(year = null) {
  const targetYear = year || new Date().getFullYear();
  console.log(`\n🚀 Starting leave balances population for year ${targetYear}...\n`);

  try {
    // Step 1: Get all employees
    console.log("📋 Fetching employees...");
    const [employees] = await pool.query("SELECT empid, name FROM employees ORDER BY empid");
    console.log(`   Found ${employees.length} employees`);

    if (employees.length === 0) {
      console.log("⚠️  No employees found. Exiting.");
      process.exit(0);
    }

    // Step 2: Get all active leave types
    console.log("\n📋 Fetching active leave types...");
    const [leaveTypes] = await pool.query(
      "SELECT leavetype_id, name, max_leaves_per_year FROM leave_types WHERE is_active = 'Y' ORDER BY leavetype_id"
    );
    console.log(`   Found ${leaveTypes.length} active leave types`);

    if (leaveTypes.length === 0) {
      console.log("⚠️  No active leave types found. Exiting.");
      process.exit(0);
    }

    // Step 3: Get existing approved leaves for the year to calculate used_leaves
    console.log("\n📋 Calculating used leaves from existing approved leaves...");
    const [approvedLeaves] = await pool.query(
      `SELECT 
        empid, 
        leavetype_id, 
        SUM(total_days) as total_used
      FROM leaves 
      WHERE status = 'APPROVED' 
        AND YEAR(start_date) = ?
      GROUP BY empid, leavetype_id`,
      [targetYear]
    );

    // Create a map for quick lookup: empid_leavetype_id -> total_used
    const usedLeavesMap = new Map();
    approvedLeaves.forEach((leave) => {
      const key = `${leave.empid}_${leave.leavetype_id}`;
      usedLeavesMap.set(key, parseFloat(leave.total_used) || 0);
    });
    console.log(`   Found ${approvedLeaves.length} employee-leave type combinations with approved leaves`);

    // Step 4: Get existing leave balances to check for carry forward
    console.log("\n📋 Checking for existing balances...");
    const [existingBalances] = await pool.query(
      "SELECT empid, leavetype_id, current_balance, carry_forward_balance FROM leave_balances WHERE year = ?",
      [targetYear - 1]
    );

    const carryForwardMap = new Map();
    existingBalances.forEach((balance) => {
      const key = `${balance.empid}_${balance.leavetype_id}`;
      const currentBalance = parseFloat(balance.current_balance) || 0;
      const carryForwardBalance = parseFloat(balance.carry_forward_balance) || 0;
      // Only carry forward if balance > 0
      carryForwardMap.set(key, Math.max(0, currentBalance));
    });
    console.log(`   Found ${existingBalances.length} existing balances from previous year`);

    // Step 5: Create leave balance records
    console.log("\n📝 Creating leave balance records...");
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const employee of employees) {
      for (const leaveType of leaveTypes) {
        const key = `${employee.empid}_${leaveType.leavetype_id}`;
        const usedLeaves = usedLeavesMap.get(key) || 0;
        const carryForwardBalance = carryForwardMap.get(key) || 0;
        
        // Set earned_leaves based on max_leaves_per_year
        // If max_leaves_per_year is NULL, set to 0 (unlimited, handled separately)
        const earnedLeaves = leaveType.max_leaves_per_year || 0;
        
        // Opening balance: carry forward from previous year if applicable
        const openingBalance = carryForwardBalance;

        try {
          const [result] = await pool.query(
            `INSERT INTO leave_balances (
              empid, 
              leavetype_id, 
              year, 
              opening_balance, 
              earned_leaves, 
              used_leaves, 
              carry_forward_balance
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              opening_balance = VALUES(opening_balance),
              earned_leaves = VALUES(earned_leaves),
              used_leaves = VALUES(used_leaves),
              carry_forward_balance = VALUES(carry_forward_balance)`,
            [
              employee.empid,
              leaveType.leavetype_id,
              targetYear,
              openingBalance,
              earnedLeaves,
              usedLeaves,
              carryForwardBalance,
            ]
          );

          if (result.affectedRows === 1 && result.insertId > 0) {
            created++;
          } else {
            updated++;
          }
        } catch (error) {
          console.error(
            `   ❌ Error creating balance for ${employee.empid} - ${leaveType.name}:`,
            error.message
          );
          skipped++;
        }
      }
    }

    // Step 6: Summary
    console.log("\n✅ Leave balances population completed!");
    console.log(`\n📊 Summary:`);
    console.log(`   Year: ${targetYear}`);
    console.log(`   Employees: ${employees.length}`);
    console.log(`   Leave Types: ${leaveTypes.length}`);
    console.log(`   Records Created: ${created}`);
    console.log(`   Records Updated: ${updated}`);
    console.log(`   Records Skipped: ${skipped}`);
    console.log(`   Total Records: ${created + updated}\n`);

    // Verify: Show sample records
    console.log("📋 Sample records (first 5):");
    const [samples] = await pool.query(
      `SELECT 
        lb.empid,
        e.name as employee_name,
        lb.leavetype_id,
        lt.name as leave_type_name,
        lb.opening_balance,
        lb.earned_leaves,
        lb.used_leaves,
        lb.current_balance,
        lb.carry_forward_balance
      FROM leave_balances lb
      LEFT JOIN employees e ON lb.empid = e.empid
      LEFT JOIN leave_types lt ON lb.leavetype_id = lt.leavetype_id
      WHERE lb.year = ?
      ORDER BY lb.empid, lb.leavetype_id
      LIMIT 5`,
      [targetYear]
    );

    samples.forEach((record) => {
      console.log(
        `   ${record.empid} (${record.employee_name}) - ${record.leave_type_name}: ` +
        `Opening=${record.opening_balance}, Earned=${record.earned_leaves}, ` +
        `Used=${record.used_leaves}, Current=${record.current_balance}`
      );
    });

    console.log("\n");
  } catch (error) {
    console.error("\n❌ Error populating leave balances:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Get year from command line argument or use current year
const yearArg = process.argv[2];
const year = yearArg ? parseInt(yearArg) : null;

if (yearArg && (isNaN(year) || year < 2000 || year > 2100)) {
  console.error("❌ Invalid year. Please provide a valid year (2000-2100)");
  console.error("Usage: node scripts/populate-leave-balances.js [year]");
  process.exit(1);
}

populateLeaveBalances(year)
  .then(() => {
    console.log("✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });

