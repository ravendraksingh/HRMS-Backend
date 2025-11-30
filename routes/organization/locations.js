const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../errors/ApiError");

/**
 * GET /locations
 * Get all office locations
 */
router.get("/", async (req, res, next) => {
  try {
    const [locations] = await pool.query(
      "SELECT * FROM office_locations ORDER BY name ASC"
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
router.get("/:id", async (req, res, next) => {
  try {
    const [[location]] = await pool.query(
      "SELECT * FROM office_locations WHERE id = ?",
      [req.params.id]
    );

    if (!location) {
      throw new ApiError("Location not found", 404);
    }

    res.json({ location });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /locations
 * Create a new office location
 */
router.post("/", async (req, res, next) => {
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
    // Validate required fields
    if (!name || !address_line1 || !city || !state || !postal_code || !country) {
      throw new ApiError(
        "name, address_line1, city, state, postal_code, and country are required",
        400
      );
    }

    // Check if name already exists (unique constraint)
    const [[existing]] = await pool.query(
      "SELECT id FROM office_locations WHERE name = ?",
      [name]
    );

    if (existing) {
      throw new ApiError(
        `Location with name '${name}' already exists`,
        400
      );
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

    // Fetch created location
    const [[location]] = await pool.query(
      "SELECT * FROM office_locations WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({
      message: "Location created successfully",
      location,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /locations/:id
 * Update an office location
 */
router.patch("/:id", async (req, res, next) => {
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
    const [[existing]] = await pool.query(
      "SELECT id FROM office_locations WHERE id = ?",
      [id]
    );

    if (!existing) {
      throw new ApiError("Location not found", 404);
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      // Check if new name conflicts with existing name
      const [[nameConflict]] = await pool.query(
        "SELECT id FROM office_locations WHERE name = ? AND id != ?",
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

    // Fetch updated location
    const [[location]] = await pool.query(
      "SELECT * FROM office_locations WHERE id = ?",
      [id]
    );

    res.json({
      message: "Location updated successfully",
      location,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /locations/:id
 * Delete an office location
 * Note: Check if location is in use before deleting
 */
router.delete("/:id", async (req, res, next) => {
  const { id } = req.params;

  try {
    // Check if location exists
    const [[existing]] = await pool.query(
      "SELECT id FROM office_locations WHERE id = ?",
      [id]
    );

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

    res.json({ message: "Location deleted successfully" });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /locations/:id/assign-employee/:empid
 * Assign a location to an employee
 */
router.post("/:id/assign-employee/:empid", async (req, res, next) => {
  const { id, empid } = req.params;

  try {
    // Validate location exists
    const [[location]] = await pool.query(
      "SELECT id, name FROM office_locations WHERE id = ?",
      [id]
    );

    if (!location) {
      throw new ApiError("Location not found", 404);
    }

    // Validate employee exists
    const [[employee]] = await pool.query(
      "SELECT empid, name FROM employees WHERE empid = ?",
      [empid]
    );

    if (!employee) {
      throw new ApiError("Employee not found", 404);
    }

    // Update employee location
    await pool.query(
      "UPDATE employees SET location_id = ? WHERE empid = ?",
      [id, empid]
    );

    res.json({
      message: "Location assigned successfully",
      location: { id: location.id, name: location.name },
      employee: { empid: employee.empid, name: employee.name },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
