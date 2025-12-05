// routes/organization/financialYears.js
// Financial Years Management Routes
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const { SELECT_EMPLOYEE_EXISTS } = require("../../queries/employees");
const { requireHRManagerOrAdmin } = require("../../middlewares/rbac");
const {
  withCache,
  invalidateFinancialYearCache,
  CACHE_PREFIXES,
} = require("../../util/cacheUtil");

/**
 * GET /financial-years
 * Get all financial years with optional filters
 * Query params: is_active (optional), is_current (optional)
 */
router.get("/", async (req, res, next) => {
  const { is_active, is_current } = req.query;

  try {
    // Build cache key based on filters
    const filterKey =
      is_active !== undefined || is_current !== undefined
        ? `:filter:${is_active || "all"}:${is_current || "all"}`
        : "";
    const cacheKey = `${CACHE_PREFIXES.FINANCIAL_YEAR}:list${filterKey}`;

    const result = await withCache(
      async () => {
        let whereClauses = [];
        let params = [];

        if (is_active !== undefined) {
          whereClauses.push("fy.is_active = ?");
          params.push(
            is_active.toUpperCase() === "TRUE" || is_active === "Y" ? "Y" : "N"
          );
        }

        if (is_current !== undefined) {
          whereClauses.push("fy.is_current = ?");
          params.push(
            is_current.toUpperCase() === "TRUE" || is_current === "Y"
              ? "Y"
              : "N"
          );
        }

        const whereSql =
          whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        const [financialYears] = await pool.query(
          `SELECT 
            fy.id,
            fy.financial_year,
            DATE_FORMAT(fy.start_date, '%Y-%m-%d') as start_date,
            DATE_FORMAT(fy.end_date, '%Y-%m-%d') as end_date,
            fy.is_current,
            fy.is_active,
            fy.description,
            fy.created_by
          FROM financial_years fy
          ${whereSql}
          ORDER BY fy.start_date DESC`,
          params
        );

        return {
          financial_years: financialYears,
        };
      },
      cacheKey,
      3600 // 1 hour TTL
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /financial-years/current
 * Get the current financial year
 * NOTE: This route must be defined BEFORE /:id to avoid route matching conflicts
 */
router.get("/current", async (req, res, next) => {
  try {
    const cacheKey = `${CACHE_PREFIXES.FINANCIAL_YEAR}:current`;

    const financialYear = await withCache(
      async () => {
        const [[row]] = await pool.query(
          `SELECT 
            id,
            financial_year,
            DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
            DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
            is_current,
            is_active,
            description
          FROM financial_years
          WHERE is_current = 'Y'
          LIMIT 1`
        );

        if (!row) {
          throw new ApiError("No current financial year found", 404);
        }

        return row;
      },
      cacheKey,
      3600 // 1 hour TTL
    );

    res.json(financialYear);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /financial-years/:id
 * Get a specific financial year by ID
 */
router.get("/:id", async (req, res, next) => {
  const { id } = req.params;

  try {
    const cacheKey = `${CACHE_PREFIXES.FINANCIAL_YEAR}:${id}`;

    const financialYear = await withCache(
      async () => {
        const [[row]] = await pool.query(
          `SELECT 
            id,
            financial_year,
            DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
            DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
            is_current,
            is_active,
            description
          FROM financial_years
          WHERE id = ?`,
          [id]
        );

        if (!row) {
          throw new ApiError("Financial year not found", 404);
        }

        return row;
      },
      cacheKey,
      3600 // 1 hour TTL
    );

    res.json(financialYear);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /financial-years
 * Create a new financial year
 * Body: financial_year (YYYY-YY), start_date (YYYY-MM-DD), end_date (YYYY-MM-DD),
 *       is_current (optional), is_active (optional), description (optional), created_by (optional)
 * Requires HRMANAGER or ADMIN role
 */
router.post("/", requireHRManagerOrAdmin, async (req, res, next) => {
  const {
    financial_year,
    start_date,
    end_date,
    is_current = "N",
    is_active = "Y",
    description,
    created_by,
  } = req.body;

  try {
    // Validate required fields
    if (!financial_year || !start_date || !end_date) {
      throw new ApiError(
        "financial_year, start_date, and end_date are required",
        400
      );
    }

    // Validate financial_year format (YYYY-YY)
    const financialYearRegex = /^\d{4}-\d{2}$/;
    if (!financialYearRegex.test(financial_year)) {
      throw new ApiError(
        "financial_year must be in format YYYY-YY (e.g., 2025-26)",
        400
      );
    }

    // Validate start_date is 1 April
    const startDateObj = new Date(start_date);
    if (startDateObj.getMonth() !== 3 || startDateObj.getDate() !== 1) {
      throw new ApiError("start_date must be 1 April (YYYY-04-01)", 400);
    }

    // Validate end_date is 31 March
    const endDateObj = new Date(end_date);
    if (endDateObj.getMonth() !== 2 || endDateObj.getDate() !== 31) {
      throw new ApiError("end_date must be 31 March (YYYY-03-31)", 400);
    }

    // Validate date relationship
    const expectedEndYear = startDateObj.getFullYear() + 1;
    if (endDateObj.getFullYear() !== expectedEndYear) {
      throw new ApiError(
        `end_date year must be ${expectedEndYear} (one year after start_date)`,
        400
      );
    }

    // Validate financial_year matches dates
    const startYear = startDateObj.getFullYear();
    const endYearShort = String(endDateObj.getFullYear()).slice(-2);
    const expectedFinancialYear = `${startYear}-${endYearShort}`;
    if (financial_year !== expectedFinancialYear) {
      throw new ApiError(
        `financial_year ${financial_year} does not match dates. Expected ${expectedFinancialYear} for start_date ${start_date}`,
        400
      );
    }

    // Check if financial_year already exists
    const [[existing]] = await pool.query(
      "SELECT id FROM financial_years WHERE financial_year = ?",
      [financial_year]
    );

    if (existing) {
      throw new ApiError(
        `Financial year ${financial_year} already exists`,
        400
      );
    }

    // If setting as current, unset all others first
    if (is_current === "Y") {
      await pool.query(
        "UPDATE financial_years SET is_current = 'N' WHERE is_current = 'Y'"
      );
    }

    // Validate created_by if provided
    if (created_by) {
      const [[employee]] = await pool.query(SELECT_EMPLOYEE_EXISTS, [
        created_by,
      ]);
      if (!employee) {
        throw new ApiError("created_by employee not found", 404);
      }
    }

    // Insert new financial year
    await pool.query(
      `INSERT INTO financial_years 
        (financial_year, start_date, end_date, is_current, is_active, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        financial_year,
        start_date,
        end_date,
        is_current === "Y" || is_current === true ? "Y" : "N",
        is_active === "Y" || is_active === true ? "Y" : "N",
        description || null,
        created_by || null,
      ]
    );

    // Invalidate financial year caches
    await invalidateFinancialYearCache();

    // Fetch created financial year
    const [[newFinancialYear]] = await pool.query(
      `SELECT 
        fy.id,
        fy.financial_year,
        DATE_FORMAT(fy.start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(fy.end_date, '%Y-%m-%d') as end_date,
        fy.is_current,
        fy.is_active,
        fy.description,
        fy.created_by,
        DATE_FORMAT(fy.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
        DATE_FORMAT(fy.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at,
        e.name as created_by_name
      FROM financial_years fy
      LEFT JOIN employees e ON fy.created_by = e.empid
      WHERE fy.financial_year = ?`,
      [financial_year]
    );

    res.status(201).json({
      message: "Financial year created successfully",
      financial_year: newFinancialYear,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /financial-years/:id
 * Update a financial year
 * Body: financial_year (optional), start_date (optional), end_date (optional),
 *       is_current (optional), is_active (optional), description (optional)
 * Requires HRMANAGER or ADMIN role
 */
router.patch("/:id", requireHRManagerOrAdmin, async (req, res, next) => {
  const { id } = req.params;
  const {
    financial_year,
    start_date,
    end_date,
    is_current,
    is_active,
    description,
  } = req.body;

  try {
    // Check if financial year exists
    const [[existing]] = await pool.query(
      "SELECT * FROM financial_years WHERE id = ?",
      [id]
    );

    if (!existing) {
      throw new ApiError("Financial year not found", 404);
    }

    const updates = [];
    const params = [];

    // Update financial_year if provided
    if (financial_year !== undefined) {
      // Validate format
      const financialYearRegex = /^\d{4}-\d{2}$/;
      if (!financialYearRegex.test(financial_year)) {
        throw new ApiError(
          "financial_year must be in format YYYY-YY (e.g., 2025-26)",
          400
        );
      }

      // Check if new financial_year already exists (excluding current record)
      const [[duplicate]] = await pool.query(
        "SELECT id FROM financial_years WHERE financial_year = ? AND id != ?",
        [financial_year, id]
      );

      if (duplicate) {
        throw new ApiError(
          `Financial year ${financial_year} already exists`,
          400
        );
      }

      updates.push("financial_year = ?");
      params.push(financial_year);
    }

    // Update start_date if provided
    if (start_date !== undefined) {
      const startDateObj = new Date(start_date);
      if (startDateObj.getMonth() !== 3 || startDateObj.getDate() !== 1) {
        throw new ApiError("start_date must be 1 April (YYYY-04-01)", 400);
      }
      updates.push("start_date = ?");
      params.push(start_date);
    }

    // Update end_date if provided
    if (end_date !== undefined) {
      const endDateObj = new Date(end_date);
      if (endDateObj.getMonth() !== 2 || endDateObj.getDate() !== 31) {
        throw new ApiError("end_date must be 31 March (YYYY-03-31)", 400);
      }
      updates.push("end_date = ?");
      params.push(end_date);
    }

    // Validate date relationship if both dates are being updated
    if (start_date !== undefined && end_date !== undefined) {
      const startDateObj = new Date(start_date);
      const endDateObj = new Date(end_date);
      const expectedEndYear = startDateObj.getFullYear() + 1;
      if (endDateObj.getFullYear() !== expectedEndYear) {
        throw new ApiError(
          `end_date year must be ${expectedEndYear} (one year after start_date)`,
          400
        );
      }
    } else if (start_date !== undefined) {
      // If only start_date is updated, validate against existing end_date
      const startDateObj = new Date(start_date);
      const existingEndDate = new Date(existing.end_date);
      const expectedEndYear = startDateObj.getFullYear() + 1;
      if (existingEndDate.getFullYear() !== expectedEndYear) {
        throw new ApiError(
          `Existing end_date does not match new start_date. Expected end_date year to be ${expectedEndYear}`,
          400
        );
      }
    } else if (end_date !== undefined) {
      // If only end_date is updated, validate against existing start_date
      const endDateObj = new Date(end_date);
      const existingStartDate = new Date(existing.start_date);
      const expectedEndYear = existingStartDate.getFullYear() + 1;
      if (endDateObj.getFullYear() !== expectedEndYear) {
        throw new ApiError(
          `New end_date year must be ${expectedEndYear} (one year after existing start_date)`,
          400
        );
      }
    }

    // Update is_current if provided
    if (is_current !== undefined) {
      const newIsCurrent =
        is_current === "Y" || is_current === true ? "Y" : "N";

      // If setting as current, unset all others first
      if (newIsCurrent === "Y" && existing.is_current !== "Y") {
        await pool.query(
          "UPDATE financial_years SET is_current = 'N' WHERE is_current = 'Y' AND id != ?",
          [id]
        );
      }

      updates.push("is_current = ?");
      params.push(newIsCurrent);
    }

    // Update is_active if provided
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(is_active === "Y" || is_active === true ? "Y" : "N");
    }

    // Update description if provided
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description || null);
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    params.push(id);

    // Execute update
    const [result] = await pool.query(
      `UPDATE financial_years SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to update financial year", 500);
    }

    // Invalidate financial year caches
    await invalidateFinancialYearCache(id);

    // Fetch updated financial year
    const [[updatedFinancialYear]] = await pool.query(
      `SELECT 
        id,
        financial_year,
        DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
        is_current,
        is_active,
        description
      FROM financial_years
      WHERE id = ?`,
      [id]
    );

    res.json(updatedFinancialYear);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /financial-years/:id
 * Delete a financial year (soft delete by setting is_active = 'N')
 * Requires HRMANAGER or ADMIN role
 */
router.delete("/:id", requireHRManagerOrAdmin, async (req, res, next) => {
  const { id } = req.params;

  try {
    // Check if financial year exists
    const [[existing]] = await pool.query(
      "SELECT id, is_current FROM financial_years WHERE id = ?",
      [id]
    );

    if (!existing) {
      throw new ApiError("Financial year not found", 404);
    }

    // Prevent deletion of current financial year
    if (existing.is_current === "Y") {
      throw new ApiError(
        "Cannot delete the current financial year. Set another financial year as current first.",
        400
      );
    }

    // Soft delete by setting is_active = 'N'
    const [result] = await pool.query(
      "UPDATE financial_years SET is_active = 'N' WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to delete financial year", 500);
    }

    // Invalidate financial year caches
    await invalidateFinancialYearCache(id);

    res.json({ message: "Financial year deactivated successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
