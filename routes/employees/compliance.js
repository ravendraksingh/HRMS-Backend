// routes/employees/compliance.js
// Employee Compliance Data Management APIs (HR Manager/Admin only)
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const { requireHrManagerOrAdmin } = require("../../util/authUtil");

// Apply HR Manager or Admin requirement to all routes
router.use(requireHrManagerOrAdmin);

/**
 * GET /employees/:employee_id/contracts
 * Get employment contracts for an employee
 */
router.get("/:employee_id/contracts", async (req, res, next) => {
  const { employee_id } = req.params;
  const { is_active, contract_type } = req.query;
    try {
    const employeeNumericId = employee_id
    ;

    let whereClause = "c.employee_id = ?";
    const params = [employeeNumericId];

    if (is_active !== undefined) {
      whereClause += " AND c.is_active = ?";
      params.push(is_active === "true" || is_active === "1" ? 1 : 0);
    }

    if (contract_type) {
      whereClause += " AND c.contract_type = ?";
      params.push(contract_type);
    }

    const [contracts] = await pool.query(
      `SELECT 
        c.*,
        e.employee_code,
        e.name as employee_name,
        signatory.name as employer_signatory_name,
        signatory.employee_code as employer_signatory_code
      FROM employees_contracts c
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN employees signatory ON c.employer_signatory = signatory.id
      WHERE ${whereClause}
      ORDER BY c.start_date DESC, c.created_at DESC`,
      params
    );

    res.json({ contracts: contracts });
  } catch (error) {
        next(error);
  }
});

/**
 * POST /employees/:employee_id/contracts
 * Create employment contract
 */
router.post("/:employee_id/contracts", async (req, res, next) => {
  const { employee_id } = req.params;
  const {
    contract_type,
    contract_number,
    start_date,
    end_date,
    notice_period_days,
    salary_mentioned,
    document_path,
    signed_date,
    employer_signatory,
    notes,
  } = req.body;
    try {
    if (!contract_type || !start_date) {
      throw new ApiError("contract_type and start_date are required", 400);
    }

    const employeeNumericId = employee_id
    ;

    let employerSignatoryId = null;
    if (employer_signatory) {
      employerSignatoryId = employer_signatory
      ;
    }

    const [result] = await pool.query(
      `INSERT INTO employees_contracts (
         employee_id, contract_type, contract_number,
        start_date, end_date, notice_period_days, salary_mentioned,
        document_path, signed_date, employer_signatory, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        
        employeeNumericId,
        contract_type,
        contract_number || null,
        start_date,
        end_date || null,
        notice_period_days || null,
        salary_mentioned || null,
        document_path || null,
        signed_date || null,
        employerSignatoryId,
        notes || null,
      ]
    );

        // Fetch created contract
    const [[contract]] = await pool.query(
      `SELECT 
        c.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_contracts c
      LEFT JOIN employees e ON c.employee_id = e.id
      WHERE c.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Contract created successfully",
      contract: contract,
    });
  } catch (error) {
        next(error);
  }
});

/**
 * GET /employees/:employee_id/work-permits
 * Get work permits and visas for an employee
 */
router.get("/:employee_id/work-permits", async (req, res, next) => {
  const { employee_id } = req.params;
  const { is_active, permit_type } = req.query;
    try {
    const employeeNumericId = employee_id
    ;

    let whereClause = "wp.employee_id = ?";
    const params = [employeeNumericId];

    if (is_active !== undefined) {
      whereClause += " AND wp.is_active = ?";
      params.push(is_active === "true" || is_active === "1" ? 1 : 0);
    }

    if (permit_type) {
      whereClause += " AND wp.permit_type = ?";
      params.push(permit_type);
    }

    const [permits] = await pool.query(
      `SELECT 
        wp.*,
        e.employee_code,
        e.name as employee_name,
        CASE 
          WHEN wp.expiry_date < CURDATE() THEN 'expired'
          WHEN wp.expiry_date <= DATE_ADD(CURDATE(), INTERVAL wp.renewal_reminder_days DAY) THEN 'expiring_soon'
          ELSE 'active'
        END as status
      FROM employees_work_permits wp
      LEFT JOIN employees e ON wp.employee_id = e.id
      WHERE ${whereClause}
      ORDER BY wp.expiry_date DESC`,
      params
    );

    res.json({ work_permits: permits });
  } catch (error) {
        next(error);
  }
});

/**
 * POST /employees/:employee_id/work-permits
 * Add work permit or visa
 */
router.post("/:employee_id/work-permits", async (req, res, next) => {
  const { employee_id } = req.params;
  const {
    permit_type,
    permit_number,
    issuing_country,
    issue_date,
    expiry_date,
    document_path,
    renewal_reminder_days,
    notes,
  } = req.body;
    try {
    if (!permit_type || !permit_number || !issuing_country || !issue_date || !expiry_date) {
      throw new ApiError(
        "permit_type, permit_number, issuing_country, issue_date, and expiry_date are required",
        400
      );
    }

    const employeeNumericId = employee_id
    ;

    const [result] = await pool.query(
      `INSERT INTO employees_work_permits (
         employee_id, permit_type, permit_number,
        issuing_country, issue_date, expiry_date, document_path,
        renewal_reminder_days, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        
        employeeNumericId,
        permit_type,
        permit_number,
        issuing_country,
        issue_date,
        expiry_date,
        document_path || null,
        renewal_reminder_days || 90,
        notes || null,
      ]
    );

        // Fetch created permit
    const [[permit]] = await pool.query(
      `SELECT 
        wp.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_work_permits wp
      LEFT JOIN employees e ON wp.employee_id = e.id
      WHERE wp.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Work permit created successfully",
      work_permit: permit,
    });
  } catch (error) {
        next(error);
  }
});

/**
 * GET /employees/:employee_id/background-checks
 * Get background checks for an employee
 */
router.get("/:employee_id/background-checks", async (req, res, next) => {
  const { employee_id } = req.params;
  const { check_type, check_status, result: checkResult } = req.query;
    try {
    const employeeNumericId = employee_id
    ;

    let whereClause = "bc.employee_id = ?";
    const params = [employeeNumericId];

    if (check_type) {
      whereClause += " AND bc.check_type = ?";
      params.push(check_type);
    }

    if (check_status) {
      whereClause += " AND bc.check_status = ?";
      params.push(check_status);
    }

    if (checkResult) {
      whereClause += " AND bc.result = ?";
      params.push(checkResult);
    }

    const [checks] = await pool.query(
      `SELECT 
        bc.*,
        e.employee_code,
        e.name as employee_name,
        verifier.name as verified_by_name
      FROM employees_background_checks bc
      LEFT JOIN employees e ON bc.employee_id = e.id
      LEFT JOIN employees verifier ON bc.verified_by = verifier.id
      WHERE ${whereClause}
      ORDER BY bc.initiated_date DESC, bc.created_at DESC`,
      params
    );

    res.json({ background_checks: checks });
  } catch (error) {
        next(error);
  }
});

/**
 * POST /employees/:employee_id/background-checks
 * Add background check record
 */
router.post("/:employee_id/background-checks", async (req, res, next) => {
  const { employee_id } = req.params;
  const {
    check_type,
    vendor_name,
    initiated_date,
    completed_date,
    result,
    report_path,
    notes,
  } = req.body;
    try {
    if (!check_type || !initiated_date) {
      throw new ApiError("check_type and initiated_date are required", 400);
    }

    const employeeNumericId = employee_id
    ;

    const [result] = await pool.query(
      `INSERT INTO employees_background_checks (
         employee_id, check_type, vendor_name,
        initiated_date, completed_date, result, report_path, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        
        employeeNumericId,
        check_type,
        vendor_name || null,
        initiated_date,
        completed_date || null,
        result || null,
        report_path || null,
        notes || null,
      ]
    );

        // Fetch created check
    const [[check]] = await pool.query(
      `SELECT 
        bc.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_background_checks bc
      LEFT JOIN employees e ON bc.employee_id = e.id
      WHERE bc.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Background check created successfully",
      background_check: check,
    });
  } catch (error) {
        next(error);
  }
});

/**
 * GET /employees/:employee_id/training-certifications
 * Get training and certifications for an employee
 */
router.get("/:employee_id/training-certifications", async (req, res, next) => {
  const { employee_id } = req.params;
  const { training_type, status, is_mandatory, is_compliance_required } = req.query;
    try {
    const employeeNumericId = employee_id
    ;

    let whereClause = "tc.employee_id = ?";
    const params = [employeeNumericId];

    if (training_type) {
      whereClause += " AND tc.training_type = ?";
      params.push(training_type);
    }

    if (status) {
      whereClause += " AND tc.status = ?";
      params.push(status);
    }

    if (is_mandatory !== undefined) {
      whereClause += " AND tc.is_mandatory = ?";
      params.push(is_mandatory === "true" || is_mandatory === "1" ? 1 : 0);
    }

    if (is_compliance_required !== undefined) {
      whereClause += " AND tc.is_compliance_required = ?";
      params.push(is_compliance_required === "true" || is_compliance_required === "1" ? 1 : 0);
    }

    const [trainings] = await pool.query(
      `SELECT 
        tc.*,
        e.employee_code,
        e.name as employee_name,
        verifier.name as verified_by_name,
        CASE 
          WHEN tc.expiry_date IS NULL THEN 'no_expiry'
          WHEN tc.expiry_date < CURDATE() THEN 'expired'
          WHEN tc.expiry_date <= DATE_ADD(CURDATE(), INTERVAL tc.renewal_reminder_days DAY) THEN 'expiring_soon'
          ELSE 'active'
        END as expiry_status
      FROM employees_training_certifications tc
      LEFT JOIN employees e ON tc.employee_id = e.id
      LEFT JOIN employees verifier ON tc.verified_by = verifier.id
      WHERE ${whereClause}
      ORDER BY tc.completion_date DESC, tc.created_at DESC`,
      params
    );

    res.json({ training_certifications: trainings });
  } catch (error) {
        next(error);
  }
});

/**
 * POST /employees/:employee_id/training-certifications
 * Add training or certification record
 */
router.post("/:employee_id/training-certifications", async (req, res, next) => {
  const { employee_id } = req.params;
  const {
    training_type,
    training_name,
    provider_name,
    certification_number,
    start_date,
    completion_date,
    expiry_date,
    status,
    is_mandatory,
    is_compliance_required,
    document_path,
    score,
    renewal_reminder_days,
    notes,
  } = req.body;
    try {
    if (!training_type || !training_name) {
      throw new ApiError("training_type and training_name are required", 400);
    }

    const employeeNumericId = employee_id
    ;

    const [result] = await pool.query(
      `INSERT INTO employees_training_certifications (
         employee_id, training_type, training_name, provider_name,
        certification_number, start_date, completion_date, expiry_date, status,
        is_mandatory, is_compliance_required, document_path, score,
        renewal_reminder_days, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        
        employeeNumericId,
        training_type,
        training_name,
        provider_name || null,
        certification_number || null,
        start_date || null,
        completion_date || null,
        expiry_date || null,
        status || "not_started",
        is_mandatory ? 1 : 0,
        is_compliance_required ? 1 : 0,
        document_path || null,
        score || null,
        renewal_reminder_days || 90,
        notes || null,
      ]
    );

        // Fetch created training
    const [[training]] = await pool.query(
      `SELECT 
        tc.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_training_certifications tc
      LEFT JOIN employees e ON tc.employee_id = e.id
      WHERE tc.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Training certification created successfully",
      training_certification: training,
    });
  } catch (error) {
        next(error);
  }
});

/**
 * GET /employees/:employee_id/health-safety
 * Get health and safety compliance records
 */
router.get("/:employee_id/health-safety", async (req, res, next) => {
  const { employee_id } = req.params;
  const { record_type, is_compliant } = req.query;
    try {
    const employeeNumericId = employee_id
    ;

    let whereClause = "hs.employee_id = ?";
    const params = [employeeNumericId];

    if (record_type) {
      whereClause += " AND hs.record_type = ?";
      params.push(record_type);
    }

    if (is_compliant !== undefined) {
      whereClause += " AND hs.is_compliant = ?";
      params.push(is_compliant === "true" || is_compliant === "1" ? 1 : 0);
    }

    const [records] = await pool.query(
      `SELECT 
        hs.*,
        e.employee_code,
        e.name as employee_name,
        verifier.name as verified_by_name,
        CASE 
          WHEN hs.expiry_date IS NULL THEN 'no_expiry'
          WHEN hs.expiry_date < CURDATE() THEN 'expired'
          WHEN hs.expiry_date <= DATE_ADD(CURDATE(), INTERVAL hs.renewal_reminder_days DAY) THEN 'expiring_soon'
          ELSE 'active'
        END as expiry_status
      FROM employees_health_safety hs
      LEFT JOIN employees e ON hs.employee_id = e.id
      LEFT JOIN employees verifier ON hs.verified_by = verifier.id
      WHERE ${whereClause}
      ORDER BY hs.conducted_date DESC, hs.created_at DESC`,
      params
    );

    res.json({ health_safety_records: records });
  } catch (error) {
        next(error);
  }
});

/**
 * POST /employees/:employee_id/health-safety
 * Add health and safety compliance record
 */
router.post("/:employee_id/health-safety", async (req, res, next) => {
  const { employee_id } = req.params;
  const {
    record_type,
    record_name,
    conducted_date,
    expiry_date,
    is_compliant,
    document_path,
    renewal_reminder_days,
    notes,
  } = req.body;
    try {
    if (!record_type || !record_name || !conducted_date) {
      throw new ApiError(
        "record_type, record_name, and conducted_date are required",
        400
      );
    }

    const employeeNumericId = employee_id
    ;

    const [result] = await pool.query(
      `INSERT INTO employees_health_safety (
         employee_id, record_type, record_name,
        conducted_date, expiry_date, is_compliant, document_path,
        renewal_reminder_days, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        
        employeeNumericId,
        record_type,
        record_name,
        conducted_date,
        expiry_date || null,
        is_compliant ? 1 : 0,
        document_path || null,
        renewal_reminder_days || 90,
        notes || null,
      ]
    );

        // Fetch created record
    const [[record]] = await pool.query(
      `SELECT 
        hs.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_health_safety hs
      LEFT JOIN employees e ON hs.employee_id = e.id
      WHERE hs.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Health safety record created successfully",
      health_safety_record: record,
    });
  } catch (error) {
        next(error);
  }
});

/**
 * GET /employees/:employee_id/disciplinary-actions
 * Get disciplinary actions and grievances
 */
router.get("/:employee_id/disciplinary-actions", async (req, res, next) => {
  const { employee_id } = req.params;
  const { action_type, status, severity } = req.query;
    try {
    const employeeNumericId = employee_id
    ;

    let whereClause = "da.employee_id = ?";
    const params = [employeeNumericId];

    if (action_type) {
      whereClause += " AND da.action_type = ?";
      params.push(action_type);
    }

    if (status) {
      whereClause += " AND da.status = ?";
      params.push(status);
    }

    if (severity) {
      whereClause += " AND da.severity = ?";
      params.push(severity);
    }

    const [actions] = await pool.query(
      `SELECT 
        da.*,
        e.employee_code,
        e.name as employee_name,
        initiator.name as initiated_by_name,
        investigator.name as investigated_by_name,
        resolver.name as resolved_by_name
      FROM employees_disciplinary_actions da
      LEFT JOIN employees e ON da.employee_id = e.id
      LEFT JOIN employees initiator ON da.initiated_by = initiator.id
      LEFT JOIN employees investigator ON da.investigated_by = investigator.id
      LEFT JOIN employees resolver ON da.resolved_by = resolver.id
      WHERE ${whereClause}
      ORDER BY da.incident_date DESC, da.created_at DESC`,
      params
    );

    res.json({ disciplinary_actions: actions });
  } catch (error) {
        next(error);
  }
});

/**
 * POST /employees/:employee_id/disciplinary-actions
 * Add disciplinary action or grievance record
 */
router.post("/:employee_id/disciplinary-actions", async (req, res, next) => {
  const { employee_id } = req.params;
  const {
    action_type,
    incident_date,
    reported_date,
    description,
    severity,
    status,
    initiated_by,
    investigated_by,
    document_path,
    is_confidential,
    notes,
  } = req.body;
    try {
    if (!action_type || !incident_date || !reported_date || !description) {
      throw new ApiError(
        "action_type, incident_date, reported_date, and description are required",
        400
      );
    }

    const employeeNumericId = employee_id
    ;

    let initiatedById = null;
    let investigatedById = null;

    if (initiated_by) {
      initiatedById = initiated_by
      ;
    }

    if (investigated_by) {
      investigatedById = investigated_by
      ;
    }

    const [result] = await pool.query(
      `INSERT INTO employees_disciplinary_actions (
         employee_id, action_type, incident_date, reported_date,
        description, severity, status, initiated_by, investigated_by,
        document_path, is_confidential, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        
        employeeNumericId,
        action_type,
        incident_date,
        reported_date,
        description,
        severity || "medium",
        status || "open",
        initiatedById,
        investigatedById,
        document_path || null,
        is_confidential !== undefined ? (is_confidential ? 1 : 0) : 1,
        notes || null,
      ]
    );

        // Fetch created action
    const [[action]] = await pool.query(
      `SELECT 
        da.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_disciplinary_actions da
      LEFT JOIN employees e ON da.employee_id = e.id
      WHERE da.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Disciplinary action created successfully",
      disciplinary_action: action,
    });
  } catch (error) {
        next(error);
  }
});

/**
 * PATCH /employees/disciplinary-actions/:id
 * Update disciplinary action (resolve, close, etc.)
 */
router.patch("/disciplinary-actions/:id", async (req, res, next) => {
  const { id } = req.params;
  const {
    status,
    resolution,
    resolution_date,
    action_taken,
    resolved_by,
  } = req.body;
    try {
    const updates = [];
    const params = [];

    if (status) {
      updates.push("status = ?");
      params.push(status);
    }

    if (resolution !== undefined) {
      updates.push("resolution = ?");
      params.push(resolution);
    }

    if (resolution_date) {
      updates.push("resolution_date = ?");
      params.push(resolution_date);
    }

    if (action_taken !== undefined) {
      updates.push("action_taken = ?");
      params.push(action_taken);
    }

    if (resolved_by) {
      const resolvedById = resolved_by
      ;
      updates.push("resolved_by = ?");
      params.push(resolvedById);
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    updates.push("updated_at = NOW()");
    params.push(id);

    const [result] = await pool.query(
      `UPDATE employees_disciplinary_actions 
      SET ${updates.join(", ")} 
      WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Disciplinary action not found", 404);
    }

        // Fetch updated action
    const [[action]] = await pool.query(
      `SELECT 
        da.*,
        e.employee_code,
        e.name as employee_name
      FROM employees_disciplinary_actions da
      LEFT JOIN employees e ON da.employee_id = e.id
      WHERE da.id = ?`,
      [id]
    );

    res.json({
      message: "Disciplinary action updated successfully",
      disciplinary_action: action,
    });
  } catch (error) {
        next(error);
  }
});

module.exports = router;

