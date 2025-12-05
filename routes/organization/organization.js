const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const {
  updateOrganizationSchema,
} = require("../../validations/organizationSchemas");
const { handleValidationErrors } = require("../../util/validation");
const { requireHRManagerOrAdmin } = require("../../middlewares/rbac");
const {
  withCache,
  invalidateOrganizationCache,
  CACHE_PREFIXES,
} = require("../../util/cacheUtil");
const { cacheHeaders } = require("../../middlewares/cacheHeaders");

/**
 * GET /organization/:orgid
 * Get organization by orgid
 */
router.get("/:orgid", cacheHeaders.mediumCache, async (req, res, next) => {
  try {
    const { orgid } = req.params;
    const cacheKey = `${CACHE_PREFIXES.ORGANIZATION}:${orgid}`;

    const organizationRow = await withCache(
      async () => {
        const [[row]] = await pool.query(
          "SELECT orgid, name, short_name, logo_url, is_active FROM organization WHERE orgid = ?",
          [orgid]
        );

        if (!row) {
          throw new ApiError("Organization not found", 404);
        }

        return row;
      },
      cacheKey,
      3600 // 1 hour TTL
    );

    res.json(organizationRow);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /organization/:orgid
 * Update an organization
 * Requires HRMANAGER or ADMIN role
 */
router.patch(
  "/:orgid",
  updateOrganizationSchema,
  handleValidationErrors,
  requireHRManagerOrAdmin,
  async (req, res, next) => {
    const { orgid } = req.params;
    const { name, short_name, logo_url, is_active } = req.body;

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
      const updates = ["name = ?", "short_name = ?", "is_active = ?"];
      const params = [
        name,
        short_name || null,
        is_active === "Y" || is_active === true ? "Y" : "N",
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

      // Invalidate organization cache
      await invalidateOrganizationCache(orgid);

      // Fetch updated organization
      const [[organizationRow]] = await pool.query(
        "SELECT orgid, name, short_name, logo_url, is_active FROM organization WHERE orgid = ?",
        [orgid]
      );

      res.json(organizationRow);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
