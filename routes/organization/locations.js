const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");

router.get("/", async (req, res, next) => {
  const organization_id = req.organizationId;
  try {
    const query = "SELECT id, name, address_line1, address_line2, city, state, postal_code, country, phone " + 
        "FROM office_locations WHERE organization_id = ? ORDER BY name ASC";
    const [rows] = await pool.query(query, [organization_id]);
    res.json({ locations: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  const organization_id = req.organizationId;
  try {
    const [rows] = await pool.query("SELECT * FROM office_locations WHERE id = ? AND organization_id = ?", 
        [req.params.id, organization_id]);
    if (rows.length === 0) throw new ApiError("Location not found", 404);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  const organization_id = req.organizationId;
  const { name, address_line1, address_line2, city, state, postal_code, country, phone } = req.body;
  try {
    if (!name) {
      throw new ApiError("name is required", 400);
    }
    const [result] = await pool.query(
      "INSERT INTO office_locations (organization_id, name, address_line1, address_line2, city, state, postal_code, country, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [organization_id, name, address_line1, address_line2, city, state, postal_code, country, phone]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  const organization_id = req.organizationId;
  const { name, address_line1, address_line2, city, state, postal_code, country, phone } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE office_locations SET name = COALESCE(?, name), address_line1 = COALESCE(?, address_line1), address_line2 = COALESCE(?, address_line2), city = COALESCE(?, city), state = COALESCE(?, state), postal_code = COALESCE(?, postal_code), country = COALESCE(?, country), phone = COALESCE(?, phone) WHERE id = ? AND organization_id = ?",
      [name, address_line1, address_line2, city, state, postal_code, country, phone, req.params.id, organization_id]
    );
    if (result.affectedRows === 0) {
      throw new ApiError("Location not found or access denied", 404);
    }
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  const organization_id = req.organizationId;
  try {
    const [result] = await pool.query(
      "DELETE FROM office_locations WHERE id = ? AND organization_id = ?",
      [req.params.id, organization_id]
    );
    if (result.affectedRows === 0) {
      throw new ApiError("Location not found or access denied", 404);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Attach location to employee
router.post("/:id/assign-employee/:employeeId", async (req, res, next) => {
  const organization_id = req.organizationId;
  try {
    const locationId = req.params.id;
    const employeeId = req.params.employeeId;
    
    // Validate location belongs to organization
    const [[loc]] = await pool.query(
      "SELECT id FROM office_locations WHERE id = ? AND organization_id = ?",
      [locationId, organization_id]
    );
    if (!loc) {
      throw new ApiError("Location not found or access denied", 404);
    }
    
    // Validate employee belongs to organization
    const [[emp]] = await pool.query(
      "SELECT id FROM employees WHERE id = ? AND organization_id = ?",
      [employeeId, organization_id]
    );
    if (!emp) {
      throw new ApiError("Employee not found or access denied", 404);
    }
    
    // Update employee location
    await pool.query(
      "UPDATE employees SET location_id = ? WHERE id = ? AND organization_id = ?",
      [locationId, employeeId, organization_id]
    );
    res.json({ assigned: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;


