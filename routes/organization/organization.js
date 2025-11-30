const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const Organization = require("../../models/Organization");
const {
  updateOrganizationSchema,
} = require("../../validations/organizationSchemas");
const { handleValidationErrors } = require("../../util/validation");
const { param } = require("express-validator");

/**
 * GET /organizations
 * Get all organizations or get organization by orgid (query param)
 */
router.get("/", async (req, res, next) => {
  try {
    // Get all organizations
    const [[organizationRow]] = await pool.query(
      "SELECT * FROM organization LIMIT 1"
    );

    if (!organizationRow) {
      throw new ApiError("Organization not found", 404);
    }

    const organization = Organization.fromDatabaseRow(organizationRow);
    res.json(organization.toJSON());
  } catch (err) {
    next(err);
  }
});

/**
 * POST /organizations
 * Create a new organization
 */
router.post("/", async (req, res, next) => {
  const { orgid, name, short_name, logo_url, is_active } = req.body;

  try {
    // Check if orgid already exists
    const [[existing]] = await pool.query(
      "SELECT orgid FROM organization WHERE orgid = ?",
      [orgid.toUpperCase()]
    );

    if (existing) {
      throw new ApiError(
        `Organization with orgid '${orgid}' already exists`,
        400
      );
    }

    // Check if name already exists (unique constraint)
    const [[existingName]] = await pool.query(
      "SELECT orgid FROM organization WHERE name = ?",
      [name]
    );

    if (existingName) {
      throw new ApiError(
        `Organization with name '${name}' already exists`,
        400
      );
    }

    // Insert organization (orgid and is_active are already sanitized by validator)
    await pool.query(
      `INSERT INTO organization (orgid, name, short_name, logo_url, is_active) 
       VALUES (?, ?, ?, ?, ?)`,
      [orgid, name, short_name || null, logo_url || null, is_active]
    );

    // Fetch created organization
    const [[organizationRow]] = await pool.query(
      "SELECT * FROM organization WHERE orgid = ?",
      [orgid]
    );

    const organization = Organization.fromDatabaseRow(organizationRow);
    res.status(201).json({
      message: "Organization created successfully",
      organization: organization.toJSON(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /organizations/:orgid
 * Update an organization
 */
router.patch(
  "/:orgid",
  updateOrganizationSchema,
  handleValidationErrors,
  async (req, res, next) => {
    const { orgid } = req.params;
    const {
      name,
      short_name,
      logo_url,
      is_active,
      financial_year,
      fy_start_date,
      fy_end_date,
    } = req.body;

    try {
      // Check if organization exists
      const [[existing]] = await pool.query(
        "SELECT orgid FROM organization WHERE orgid = ?",
        [orgid]
      );

      if (!existing) {
        throw new ApiError("Organization not found", 404);
      }

      // Check if new name conflicts with existing name
      const [[nameConflict]] = await pool.query(
        "SELECT orgid FROM organization WHERE name = ? AND orgid != ?",
        [name, orgid]
      );

      if (nameConflict) {
        throw new ApiError(
          `Organization with name '${name}' already exists`,
          400
        );
      }

      // Build update query - all required fields are now mandatory
      const updates = [
        "name = ?",
        "short_name = ?",
        "is_active = ?",
        "financial_year = ?",
        "fy_start_date = ?",
        "fy_end_date = ?",
      ];
      const params = [
        name,
        short_name || null,
        is_active,
        financial_year,
        fy_start_date,
        fy_end_date,
      ];

      // Add optional logo_url if provided
      if (logo_url !== undefined) {
        updates.push("logo_url = ?");
        params.push(logo_url || null);
      }

      params.push(orgid);

      const [result] = await pool.query(
        `UPDATE organization SET ${updates.join(", ")} WHERE orgid = ?`,
        params
      );

      if (result.affectedRows === 0) {
        throw new ApiError("Failed to update organization", 500);
      }

      // Fetch updated organization
      const [[organizationRow]] = await pool.query(
        "SELECT * FROM organization WHERE orgid = ?",
        [orgid]
      );

      const organization = Organization.fromDatabaseRow(organizationRow);
      res.json({
        message: "Organization updated successfully",
        organization: organization.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /organizations/:orgid
 * Delete an organization (soft delete by setting is_active = 'N')
 */
router.delete(
  "/:orgid",
  [param("orgid").notEmpty().trim().toUpperCase()],
  handleValidationErrors,
  async (req, res, next) => {
    const { orgid } = req.params;

    try {
      // Check if organization exists
      const [[existing]] = await pool.query(
        "SELECT orgid FROM organization WHERE orgid = ?",
        [orgid]
      );

      if (!existing) {
        throw new ApiError("Organization not found", 404);
      }

      // Soft delete by setting is_active = 'N'
      const [result] = await pool.query(
        "UPDATE organization SET is_active = 'N' WHERE orgid = ?",
        [orgid]
      );

      if (result.affectedRows === 0) {
        throw new ApiError("Failed to delete organization", 500);
      }

      res.json({ message: "Organization deactivated successfully" });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
