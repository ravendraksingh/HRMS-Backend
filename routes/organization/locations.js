const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");
const {
  locationIdParamSchema,
  createLocationSchema,
  updateLocationSchema,
} = require("../../validations/locationSchemas");
const { handleValidationErrors } = require("../../util/validation");
const {
  SELECT_ALL_LOCATIONS,
  SELECT_LOCATION_BY_ID,
  SELECT_LOCATION_EXISTS,
  SELECT_LOCATION_BY_NAME,
  SELECT_LOCATION_NAME_CONFLICT,
} = require("../../queries/locations");
const { requireHRManagerOrAdmin } = require("../../middlewares/rbac");
const {
  withCache,
  invalidateLocationCache,
  CACHE_PREFIXES,
} = require("../../util/cacheUtil");
const { cacheHeaders } = require("../../middlewares/cacheHeaders");

/**
 * GET /locations
 * Get all office locations
 */
router.get("/", cacheHeaders.longCache, async (req, res, next) => {
  try {
    const cacheKey = `${CACHE_PREFIXES.LOCATION}:all`;

    const locations = await withCache(
      async () => {
        const [rows] = await pool.query(SELECT_ALL_LOCATIONS);
        return rows;
      },
      cacheKey,
      3600 // 1 hour TTL
    );

    res.json({ locations });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /locations/:id
 * Get office location by ID
 */
router.get("/:id", cacheHeaders.longCache, async (req, res, next) => {
  try {
    const cacheKey = `${CACHE_PREFIXES.LOCATION}:${req.params.id}`;

    const location = await withCache(
      async () => {
        const [rows] = await pool.query(SELECT_LOCATION_BY_ID, [req.params.id]);

        if (rows.length === 0) {
          throw new ApiError("Location not found", 404);
        }

        return rows[0];
      },
      cacheKey,
      3600 // 1 hour TTL
    );

    res.json(location);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /locations
 * Create a new office location
 * Requires HRMANAGER or ADMIN role
 */
router.post(
  "/",
  createLocationSchema,
  handleValidationErrors,
  requireHRManagerOrAdmin,
  async (req, res, next) => {
    const {
      name,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      phone,
    } = req.body;

    try {
      // Check if name already exists (unique constraint)
      const [[existing]] = await pool.query(SELECT_LOCATION_BY_NAME, [name]);

      if (existing) {
        throw new ApiError(`Location with name '${name}' already exists`, 400);
      }

      // Insert location
      const [result] = await pool.query(
        `INSERT INTO office_locations 
       (name, address_line1, address_line2, city, state, postal_code, country, phone) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          address_line1,
          address_line2 || null,
          city,
          state,
          postal_code,
          country,
          phone || null,
        ]
      );

      // Invalidate location cache
      await invalidateLocationCache();

      // Fetch created location
      const [rows] = await pool.query(SELECT_LOCATION_BY_ID, [result.insertId]);

      res.status(201).json({
        message: "Location created successfully",
        location: rows[0],
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /locations/:id
 * Update an office location
 * Requires HRMANAGER or ADMIN role
 */
router.patch(
  "/:id",
  updateLocationSchema,
  handleValidationErrors,
  requireHRManagerOrAdmin,
  async (req, res, next) => {
    const { id } = req.params;
    const {
      name,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      phone,
    } = req.body;

    try {
      // Check if location exists
      const [[existing]] = await pool.query(SELECT_LOCATION_EXISTS, [id]);

      if (!existing) {
        throw new ApiError("Location not found", 404);
      }

      // Build update query
      const updates = [];
      const params = [];

      if (name !== undefined) {
        // Check if new name conflicts with existing name
        const [[nameConflict]] = await pool.query(
          SELECT_LOCATION_NAME_CONFLICT,
          [name, id]
        );

        if (nameConflict) {
          throw new ApiError(
            `Location with name '${name}' already exists`,
            400
          );
        }

        updates.push("name = ?");
        params.push(name);
      }

      if (address_line1 !== undefined) {
        updates.push("address_line1 = ?");
        params.push(address_line1);
      }

      if (address_line2 !== undefined) {
        updates.push("address_line2 = ?");
        params.push(address_line2 || null);
      }

      if (city !== undefined) {
        updates.push("city = ?");
        params.push(city);
      }

      if (state !== undefined) {
        updates.push("state = ?");
        params.push(state);
      }

      if (postal_code !== undefined) {
        updates.push("postal_code = ?");
        params.push(postal_code);
      }

      if (country !== undefined) {
        updates.push("country = ?");
        params.push(country);
      }

      if (phone !== undefined) {
        updates.push("phone = ?");
        params.push(phone || null);
      }

      if (updates.length === 0) {
        throw new ApiError("No fields to update", 400);
      }

      params.push(id);

      const [result] = await pool.query(
        `UPDATE office_locations SET ${updates.join(", ")} WHERE id = ?`,
        params
      );

      if (result.affectedRows === 0) {
        throw new ApiError("Failed to update location", 500);
      }

      // Invalidate location cache
      await invalidateLocationCache(id);

      // Fetch updated location
      const [rows] = await pool.query(SELECT_LOCATION_BY_ID, [id]);

      res.json({
        message: "Location updated successfully",
        location: rows[0],
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /locations/:id
 * Delete an office location
 * Note: Check if location is in use before deleting
 * Requires HRMANAGER or ADMIN role
 */
router.delete(
  "/:id",
  locationIdParamSchema,
  handleValidationErrors,
  requireHRManagerOrAdmin,
  async (req, res, next) => {
    const { id } = req.params;

    try {
      // Check if location exists
      const [[existing]] = await pool.query(SELECT_LOCATION_EXISTS, [id]);

      if (!existing) {
        throw new ApiError("Location not found", 404);
      }

      // Check if location is assigned to any employees
      const [[inUse]] = await pool.query(
        "SELECT COUNT(*) as count FROM employees WHERE location_id = ?",
        [id]
      );

      if (inUse.count > 0) {
        throw new ApiError(
          `Cannot delete location. It is assigned to ${inUse.count} employee(s). Please reassign employees first.`,
          400
        );
      }

      // Delete location
      const [result] = await pool.query(
        "DELETE FROM office_locations WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        throw new ApiError("Failed to delete location", 500);
      }

      // Invalidate location cache
      await invalidateLocationCache(id);

      res.json({ message: "Location deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
