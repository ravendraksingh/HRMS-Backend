// routes/employees/payroll.js
// Employee Payroll Information Management APIs (HR Manager/Admin only)
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { requireHrManagerOrAdmin } = require("../../util/authUtil");

// Apply HR Manager or Admin requirement to all routes
router.use(requireHrManagerOrAdmin);

/**
 * GET /employees/:employee_id/payroll-information
 * Get payroll information for an employee
 */
router.get("/:employee_id/payroll-information", async (req, res, next) => {
  const { employee_id } = req.params;
    try {
    const employeeNumericId = employee_id
    ;

    const [[payrollInfo]] = await pool.query(
      `SELECT 
        pi.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_payroll_information pi
      LEFT JOIN employees e ON pi.employee_id = e.id
      WHERE pi.employee_id = ?`,
      [employeeNumericId]
    );

    if (!payrollInfo) {
      return res.json({ payroll_information: null });
    }

    res.json({ payroll_information: payrollInfo });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /employees/:employee_id/payroll-information
 * Create or update payroll information
 */
router.post("/:employee_id/payroll-information", async (req, res, next) => {
  const { employee_id } = req.params;
  const {
    bank_name,
    account_number,
    account_holder_name,
    ifsc_code,
    swift_code,
    branch_name,
    branch_address,
    account_type,
    pan_number,
    aadhaar_number,
    ssn,
    tax_id,
    tax_country,
    payment_method,
    payroll_frequency,
    pf_number,
    esi_number,
    uan_number,
  } = req.body;
    try {
    if (!bank_name || !account_number || !account_holder_name) {
      throw new ApiError(
        "bank_name, account_number, and account_holder_name are required",
        400
      );
    }

    const employeeNumericId = employee_id
    ;

    // Check if payroll info already exists
    const [[existing]] = await pool.query(
      "SELECT id FROM employees_payroll_information WHERE employee_id = ?",
      [employeeNumericId]
    );

    if (existing) {
      // Update existing
      const [result] = await pool.query(
        `UPDATE employees_payroll_information 
        SET bank_name = ?, account_number = ?, account_holder_name = ?,
            ifsc_code = ?, swift_code = ?, branch_name = ?, branch_address = ?,
            account_type = ?, pan_number = ?, aadhaar_number = ?, ssn = ?,
            tax_id = ?, tax_country = ?, payment_method = ?, payroll_frequency = ?,
            pf_number = ?, esi_number = ?, uan_number = ?, updated_at = NOW()
        WHERE employee_id = ?`,
        [
          bank_name,
          account_number,
          account_holder_name,
          ifsc_code || null,
          swift_code || null,
          branch_name || null,
          branch_address || null,
          account_type || "salary",
          pan_number || null,
          aadhaar_number || null,
          ssn || null,
          tax_id || null,
          tax_country || null,
          payment_method || "bank_transfer",
          payroll_frequency || "monthly",
          pf_number || null,
          esi_number || null,
          uan_number || null,
          employeeNumericId,
        ]
      );
    } else {
      // Create new
      const [result] = await pool.query(
        `INSERT INTO employees_payroll_information (
           employee_id, bank_name, account_number, account_holder_name,
          ifsc_code, swift_code, branch_name, branch_address, account_type,
          pan_number, aadhaar_number, ssn, tax_id, tax_country,
          payment_method, payroll_frequency, pf_number, esi_number, uan_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          
          employeeNumericId,
          bank_name,
          account_number,
          account_holder_name,
          ifsc_code || null,
          swift_code || null,
          branch_name || null,
          branch_address || null,
          account_type || "salary",
          pan_number || null,
          aadhaar_number || null,
          ssn || null,
          tax_id || null,
          tax_country || null,
          payment_method || "bank_transfer",
          payroll_frequency || "monthly",
          pf_number || null,
          esi_number || null,
          uan_number || null,
        ]
      );
    }

    // Fetch updated/created info
    const [[payrollInfo]] = await pool.query(
      `SELECT 
        pi.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_payroll_information pi
      LEFT JOIN employees e ON pi.employee_id = e.id
      WHERE pi.employee_id = ?`,
      [employeeNumericId]
    );

    res.json({
      message: "Payroll information saved successfully",
      payroll_information: payrollInfo,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /employees/:employee_id/salary-structure
 * Get current and historical salary structures
 */
router.get("/:employee_id/salary-structure", async (req, res, next) => {
  const { employee_id } = req.params;
  const { current_only } = req.query;
    try {
    const employeeNumericId = employee_id
    ;

    let query = `SELECT 
      ss.*,
      e.employee_code,
      e.name as employee_name,
      approver.name as approved_by_name
    FROM employees_salary_structure ss
    LEFT JOIN employees e ON ss.employee_id = e.id
    LEFT JOIN employees approver ON ss.approved_by = approver.id
    WHERE ss.employee_id = ?`;

    if (current_only === "true") {
      query += " AND (ss.effective_to IS NULL OR ss.effective_to >= CURDATE())";
    }

    query += " ORDER BY ss.effective_from DESC";

    const [structures] = await pool.query(query, [
      employeeNumericId,
    ]);

    res.json({ salary_structures: structures });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /employees/:employee_id/salary-structure
 * Create new salary structure
 */
router.post("/:employee_id/salary-structure", async (req, res, next) => {
  const { employee_id } = req.params;
  const {
    effective_from,
    effective_to,
    basic_salary,
    house_rent_allowance,
    transport_allowance,
    medical_allowance,
    special_allowance,
    food_allowance,
    other_allowances,
    provident_fund,
    professional_tax,
    income_tax,
    other_deductions,
    currency,
    notes,
  } = req.body;
    const approved_by = req.user.employee_id;

  try {
    if (!effective_from || !basic_salary) {
      throw new ApiError("effective_from and basic_salary are required", 400);
    }

    const employeeNumericId = employee_id
    ;

    // End previous salary structure if exists
    await pool.query(
      `UPDATE employees_salary_structure 
      SET effective_to = DATE_SUB(?, INTERVAL 1 DAY), updated_at = NOW()
      WHERE employee_id = ? 
      AND (effective_to IS NULL OR effective_to >= ?)`,
      [effective_from, employeeNumericId, effective_from]
    );

    // Create new salary structure
    const [result] = await pool.query(
      `INSERT INTO employees_salary_structure (
         employee_id, effective_from, effective_to,
        basic_salary, house_rent_allowance, transport_allowance, medical_allowance,
        special_allowance, food_allowance, other_allowances,
        provident_fund, professional_tax, income_tax, other_deductions,
        currency, notes, approved_by, approved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        
        employeeNumericId,
        effective_from,
        effective_to || null,
        basic_salary,
        house_rent_allowance || 0,
        transport_allowance || 0,
        medical_allowance || 0,
        special_allowance || 0,
        food_allowance || 0,
        other_allowances || 0,
        provident_fund || 0,
        professional_tax || 0,
        income_tax || 0,
        other_deductions || 0,
        currency || "USD",
        notes || null,
        approved_by,
      ]
    );

    // Fetch created structure
    const [[structure]] = await pool.query(
      `SELECT 
        ss.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_salary_structure ss
      LEFT JOIN employees e ON ss.employee_id = e.id
      WHERE ss.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Salary structure created successfully",
      salary_structure: structure,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /employees/:employee_id/benefits
 * Get benefits enrollment for an employee
 */
router.get("/:employee_id/benefits", async (req, res, next) => {
  const { employee_id } = req.params;
  const { is_active } = req.query;
    try {
    const employeeNumericId = employee_id
    ;

    let whereClause = "be.employee_id = ?";
    const params = [employeeNumericId];

    if (is_active !== undefined) {
      whereClause += " AND be.is_active = ?";
      params.push(is_active === "true" || is_active === "1" ? 1 : 0);
    }

    const [benefits] = await pool.query(
      `SELECT 
        be.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_benefits_enrollment be
      LEFT JOIN employees e ON be.employee_id = e.id
      WHERE ${whereClause}
      ORDER BY be.enrollment_date DESC`,
      params
    );

    res.json({ benefits: benefits });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /employees/:employee_id/benefits
 * Enroll employee in a benefit
 */
router.post("/:employee_id/benefits", async (req, res, next) => {
  const { employee_id } = req.params;
  const {
    benefit_type,
    benefit_name,
    provider_name,
    policy_number,
    enrollment_date,
    coverage_start_date,
    coverage_end_date,
    premium_amount,
    employee_contribution,
    employer_contribution,
    notes,
  } = req.body;
    try {
    if (!benefit_type || !benefit_name || !enrollment_date || !coverage_start_date) {
      throw new ApiError(
        "benefit_type, benefit_name, enrollment_date, and coverage_start_date are required",
        400
      );
    }

    const employeeNumericId = employee_id
    ;

    const [result] = await pool.query(
      `INSERT INTO employees_benefits_enrollment (
         employee_id, benefit_type, benefit_name, provider_name,
        policy_number, enrollment_date, coverage_start_date, coverage_end_date,
        premium_amount, employee_contribution, employer_contribution, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        
        employeeNumericId,
        benefit_type,
        benefit_name,
        provider_name || null,
        policy_number || null,
        enrollment_date,
        coverage_start_date,
        coverage_end_date || null,
        premium_amount || null,
        employee_contribution || null,
        employer_contribution || null,
        notes || null,
      ]
    );

    // Fetch created benefit
    const [[benefit]] = await pool.query(
      `SELECT 
        be.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_benefits_enrollment be
      LEFT JOIN employees e ON be.employee_id = e.id
      WHERE be.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Benefit enrollment created successfully",
      benefit: benefit,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /employees/:employee_id/payslips
 * Get payslips for an employee
 */
router.get("/:employee_id/payslips", async (req, res, next) => {
  const { employee_id } = req.params;
  const { from_date, to_date, status } = req.query;
    try {
    const employeeNumericId = employee_id
    ;

    let whereClause = "p.employee_id = ?";
    const params = [employeeNumericId];

    if (from_date) {
      whereClause += " AND p.payroll_period_end >= ?";
      params.push(from_date);
    }

    if (to_date) {
      whereClause += " AND p.payroll_period_start <= ?";
      params.push(to_date);
    }

    if (status) {
      whereClause += " AND p.status = ?";
      params.push(status);
    }

    const [payslips] = await pool.query(
      `SELECT 
        p.*,
        e.employee_code,
        e.name as employee_name,
        generator.name as generated_by_name
      FROM employees_payslips p
      LEFT JOIN employees e ON p.employee_id = e.id
      LEFT JOIN employees generator ON p.generated_by = generator.id
      WHERE ${whereClause}
      ORDER BY p.payroll_period_end DESC, p.created_at DESC`,
      params
    );

    res.json({ payslips: payslips });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /employees/:employee_id/tax-forms
 * Get tax forms for an employee
 */
router.get("/:employee_id/tax-forms", async (req, res, next) => {
  const { employee_id } = req.params;
  const { form_type, tax_year, is_active } = req.query;
    try {
    const employeeNumericId = employee_id
    ;

    let whereClause = "tf.employee_id = ?";
    const params = [employeeNumericId];

    if (form_type) {
      whereClause += " AND tf.form_type = ?";
      params.push(form_type);
    }

    if (tax_year) {
      whereClause += " AND tf.tax_year = ?";
      params.push(tax_year);
    }

    if (is_active !== undefined) {
      whereClause += " AND tf.is_active = ?";
      params.push(is_active === "true" || is_active === "1" ? 1 : 0);
    }

    const [taxForms] = await pool.query(
      `SELECT 
        tf.*,
        e.employee_code,
        e.name as employee_name,
        verifier.name as verified_by_name
      FROM employees_tax_forms tf
      LEFT JOIN employees e ON tf.employee_id = e.id
      LEFT JOIN employees verifier ON tf.verified_by = verifier.id
      WHERE ${whereClause}
      ORDER BY tf.tax_year DESC, tf.created_at DESC`,
      params
    );

    res.json({ tax_forms: taxForms });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /employees/:employee_id/tax-forms
 * Add tax form for an employee
 */
router.post("/:employee_id/tax-forms", async (req, res, next) => {
  const { employee_id } = req.params;
  const {
    form_type,
    form_name,
    tax_year,
    filing_status,
    exemptions,
    additional_withholding,
    document_path,
    submitted_date,
    notes,
  } = req.body;
    try {
    if (!form_type || !form_name) {
      throw new ApiError("form_type and form_name are required", 400);
    }

    const employeeNumericId = employee_id
    ;

    const [result] = await pool.query(
      `INSERT INTO employees_tax_forms (
         employee_id, form_type, form_name, tax_year,
        filing_status, exemptions, additional_withholding, document_path,
        submitted_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        
        employeeNumericId,
        form_type,
        form_name,
        tax_year || null,
        filing_status || null,
        exemptions || 0,
        additional_withholding || 0,
        document_path || null,
        submitted_date || null,
        notes || null,
      ]
    );

    // Fetch created form
    const [[taxForm]] = await pool.query(
      `SELECT 
        tf.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_tax_forms tf
      LEFT JOIN employees e ON tf.employee_id = e.id
      WHERE tf.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Tax form created successfully",
      tax_form: taxForm,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

