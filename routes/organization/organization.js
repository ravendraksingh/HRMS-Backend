const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

/**
 * GET /organizations
 * Get all organizations or get organization by orgid (query param)
 */
router.get("/", async (req, res, next) => {
  const { orgid } = req.query;

  try {
    if (orgid) {
      // Get organization by orgid
      const [[organization]] = await pool.query(
        "SELECT * FROM organization WHERE orgid = ?",
        [orgid.toUpperCase()]
      );

      if (!organization) {
        throw new ApiError("Organization not found", 404);
      }

      return res.json({ organization });
    }

    // Get all organizations
    const [organizations] = await pool.query(
      "SELECT * FROM organization ORDER BY name ASC"
    );

    res.json({ organizations });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /organizations/:orgid
 * Get organization by orgid
 */
router.get("/:orgid", async (req, res, next) => {
  try {
    const [[organization]] = await pool.query(
      "SELECT * FROM organization WHERE orgid = ?",
      [req.params.orgid.toUpperCase()]
    );

    if (!organization) {
      throw new ApiError("Organization not found", 404);
    }

    res.json({ organization });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /organizations
 * Create a new organization
 */
router.post("/", async (req, res, next) => {
  const { orgid, name, short_name, logo_url, is_active = "N" } = req.body;

  try {
    // Validate required fields
    if (!orgid || !name) {
      throw new ApiError("orgid and name are required", 400);
    }

    // Validate orgid length (VARCHAR(10))
    if (orgid.length > 10) {
      throw new ApiError("orgid must be 10 characters or less", 400);
    }

    // Validate is_active value
    if (!["Y", "N"].includes(is_active.toUpperCase())) {
      throw new ApiError("is_active must be 'Y' or 'N'", 400);
    }

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

    // Insert organization
    await pool.query(
      `INSERT INTO organization (orgid, name, short_name, logo_url, is_active) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        orgid.toUpperCase(),
        name,
        short_name || null,
        logo_url || null,
        is_active.toUpperCase(),
      ]
    );

    // Fetch created organization
    const [[organization]] = await pool.query(
      "SELECT * FROM organization WHERE orgid = ?",
      [orgid.toUpperCase()]
    );

    res.status(201).json({
      message: "Organization created successfully",
      organization,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /organizations/:orgid
 * Update an organization
 */
router.patch("/:orgid", async (req, res, next) => {
  const { orgid } = req.params;
  const { name, short_name, logo_url, is_active } = req.body;

  try {
    // Check if organization exists
    const [[existing]] = await pool.query(
      "SELECT orgid FROM organization WHERE orgid = ?",
      [orgid.toUpperCase()]
    );

    if (!existing) {
      throw new ApiError("Organization not found", 404);
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      // Check if new name conflicts with existing name
      const [[nameConflict]] = await pool.query(
        "SELECT orgid FROM organization WHERE name = ? AND orgid != ?",
        [name, orgid.toUpperCase()]
      );

      if (nameConflict) {
        throw new ApiError(
          `Organization with name '${name}' already exists`,
          400
        );
      }

      updates.push("name = ?");
      params.push(name);
    }

    if (short_name !== undefined) {
      updates.push("short_name = ?");
      params.push(short_name || null);
    }

    if (logo_url !== undefined) {
      updates.push("logo_url = ?");
      params.push(logo_url || null);
    }

    if (is_active !== undefined) {
      if (!["Y", "N"].includes(is_active.toUpperCase())) {
        throw new ApiError("is_active must be 'Y' or 'N'", 400);
      }
      updates.push("is_active = ?");
      params.push(is_active.toUpperCase());
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400);
    }

    params.push(orgid.toUpperCase());

    const [result] = await pool.query(
      `UPDATE organization SET ${updates.join(", ")} WHERE orgid = ?`,
      params
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to update organization", 500);
    }

    // Fetch updated organization
    const [[organization]] = await pool.query(
      "SELECT * FROM organization WHERE orgid = ?",
      [orgid.toUpperCase()]
    );

    res.json({
      message: "Organization updated successfully",
      organization,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /organizations/:orgid
 * Delete an organization (soft delete by setting is_active = 'N')
 */
router.delete("/:orgid", async (req, res, next) => {
  const { orgid } = req.params;

  try {
    // Check if organization exists
    const [[existing]] = await pool.query(
      "SELECT orgid FROM organization WHERE orgid = ?",
      [orgid.toUpperCase()]
    );

    if (!existing) {
      throw new ApiError("Organization not found", 404);
    }

    // Soft delete by setting is_active = 'N'
    const [result] = await pool.query(
      "UPDATE organization SET is_active = 'N' WHERE orgid = ?",
      [orgid.toUpperCase()]
    );

    if (result.affectedRows === 0) {
      throw new ApiError("Failed to delete organization", 500);
    }

    res.json({ message: "Organization deactivated successfully" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

