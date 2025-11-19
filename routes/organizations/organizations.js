const express = require("express");
const router = express.Router();
const pool = require("../../db");
const ApiError = require("../../util/ApiError");
const { authenticateJWT } = require("../../middlewares/authenticateJWT");
const { extractOrganizationId } = require("../../middlewares/organization");
const { validateOrganizationAccess } = require("../../util/securityUtil");

// Get organization(s) - supports query by code or by ID
router.get("/", async (req, res, next) => {
  const { organization_code, code } = req.query;

  try {
    let organization = null;

    // Query by organization_code or code (both supported)
    const orgCode = organization_code || code;

    if (orgCode) {
      // Fetch organization by code
      const [[org]] = await pool.query(
        "SELECT id, code, name, logo_url, is_active, created_at, updated_at FROM organizations WHERE code = ?",
        [orgCode]
      );
      organization = org;
    } else {
      throw new ApiError(
        "organization_code or code query parameter is required",
        400
      );
    }

    if (!organization) {
      throw new ApiError("Organization not found", 404);
    }

    // Format response with required fields (supporting both naming conventions)
    const response = {
      id: organization.id,
      organization_code: organization.code,
      code: organization.code,
      organization_name: organization.name,
      name: organization.name,
      logo_url: organization.logo_url || null,
      logo: organization.logo_url || null,
      is_active: organization.is_active === 1,
      created_at: organization.created_at,
      updated_at: organization.updated_at,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Get organization by ID
router.get("/:id", async (req, res, next) => {
  const organizationId = req.params.id;

  try {
    // Validate organization ID
    const id = parseInt(organizationId, 10);
    if (isNaN(id) || id <= 0) {
      throw new ApiError("Invalid organization ID", 400);
    }

    // Fetch organization details
    const [[organization]] = await pool.query(
      "SELECT id, code, name, logo_url, is_active, created_at, updated_at FROM organizations WHERE id = ?",
      [id]
    );

    if (!organization) {
      throw new ApiError("Organization not found", 404);
    }

    // Format response with required fields (supporting both naming conventions)
    const response = {
      id: organization.id,
      organization_code: organization.code,
      code: organization.code,
      organization_name: organization.name,
      name: organization.name,
      logo_url: organization.logo_url || null,
      logo: organization.logo_url || null,
      is_active: organization.is_active === 1,
      created_at: organization.created_at,
      updated_at: organization.updated_at,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /organizations
 * Create a new organization
 * Body: { code, name, logo_url (optional), is_active (optional, default: true) }
 */
router.post("/", async (req, res, next) => {
  const { code, name, logo_url, is_active = true } = req.body;

  try {
    // Validate required fields
    if (!code || !name) {
      throw new ApiError("code and name are required", 400);
    }

    // Validate code format (alphanumeric, underscore, hyphen)
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      throw new ApiError(
        "code must contain only alphanumeric characters, underscores, or hyphens",
        400
      );
    }

    // Validate name length
    if (name.length > 200) {
      throw new ApiError("name must be 200 characters or less", 400);
    }

    // Validate code length
    if (code.length > 50) {
      throw new ApiError("code must be 50 characters or less", 400);
    }

    // Check if code already exists
    const [[existingByCode]] = await pool.query(
      "SELECT id FROM organizations WHERE code = ?",
      [code]
    );
    if (existingByCode) {
      throw new ApiError("Organization code already exists", 409);
    }

    // Check if name already exists
    const [[existingByName]] = await pool.query(
      "SELECT id FROM organizations WHERE name = ?",
      [name]
    );
    if (existingByName) {
      throw new ApiError("Organization name already exists", 409);
    }

    // Validate logo_url if provided
    if (logo_url && logo_url.length > 500) {
      throw new ApiError("logo_url must be 500 characters or less", 400);
    }

    // Validate is_active is boolean
    const isActiveValue =
      is_active === true || is_active === 1 || is_active === "1" ? 1 : 0;

    // Insert new organization
    const [result] = await pool.query(
      "INSERT INTO organizations (code, name, logo_url, is_active) VALUES (?, ?, ?, ?)",
      [code, name, logo_url || null, isActiveValue]
    );

    // Fetch created organization
    const [[newOrganization]] = await pool.query(
      "SELECT id, code, name, logo_url, is_active, created_at, updated_at FROM organizations WHERE id = ?",
      [result.insertId]
    );

    // Format response with required fields (supporting both naming conventions)
    const response = {
      id: newOrganization.id,
      organization_code: newOrganization.code,
      code: newOrganization.code,
      organization_name: newOrganization.name,
      name: newOrganization.name,
      logo_url: newOrganization.logo_url || null,
      logo: newOrganization.logo_url || null,
      is_active: newOrganization.is_active === 1,
      created_at: newOrganization.created_at,
      updated_at: newOrganization.updated_at,
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /organizations/:id
 * Update an existing organization
 * Body: { code (optional), name (optional), logo_url (optional), is_active (optional) }
 * 
 * SECURITY: Requires authentication. Users can only update their own organization.
 */
router.patch("/:id", authenticateJWT, extractOrganizationId, async (req, res, next) => {
  const organizationId = req.params.id;
  const userOrganizationId = req.organizationId; // From JWT token
  const { code, name, logo_url, is_active } = req.body;

  try {
    // Validate organization ID
    const id = parseInt(organizationId, 10);
    if (isNaN(id) || id <= 0) {
      throw new ApiError("Invalid organization ID", 400);
    }

    // SECURITY: Verify user can only update their own organization
    if (id !== userOrganizationId) {
      throw new ApiError("Access denied: Cannot modify other organizations", 403);
    }

    // Check if organization exists
    const [[existingOrg]] = await pool.query(
      "SELECT id, code, name FROM organizations WHERE id = ?",
      [id]
    );
    if (!existingOrg) {
      throw new ApiError("Organization not found", 404);
    }

    // Prepare updates
    const updates = [];
    const params = [];

    // Update code if provided
    if (code !== undefined) {
      if (!code) {
        throw new ApiError("code cannot be empty", 400);
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
        throw new ApiError(
          "code must contain only alphanumeric characters, underscores, or hyphens",
          400
        );
      }
      if (code.length > 50) {
        throw new ApiError("code must be 50 characters or less", 400);
      }

      // Check if new code already exists (excluding current organization)
      const [[existingByCode]] = await pool.query(
        "SELECT id FROM organizations WHERE code = ? AND id != ?",
        [code, id]
      );
      if (existingByCode) {
        throw new ApiError("Organization code already exists", 409);
      }

      updates.push("code = ?");
      params.push(code);
    }

    // Update name if provided
    if (name !== undefined) {
      if (!name) {
        throw new ApiError("name cannot be empty", 400);
      }
      if (name.length > 200) {
        throw new ApiError("name must be 200 characters or less", 400);
      }

      // Check if new name already exists (excluding current organization)
      const [[existingByName]] = await pool.query(
        "SELECT id FROM organizations WHERE name = ? AND id != ?",
        [name, id]
      );
      if (existingByName) {
        throw new ApiError("Organization name already exists", 409);
      }

      updates.push("name = ?");
      params.push(name);
    }

    // Update logo_url if provided
    if (logo_url !== undefined) {
      if (logo_url === null || logo_url === "") {
        updates.push("logo_url = NULL");
      } else {
        if (logo_url.length > 500) {
          throw new ApiError("logo_url must be 500 characters or less", 400);
        }
        updates.push("logo_url = ?");
        params.push(logo_url);
      }
    }

    // Update is_active if provided
    if (is_active !== undefined) {
      const isActiveValue =
        is_active === true || is_active === 1 || is_active === "1" ? 1 : 0;
      updates.push("is_active = ?");
      params.push(isActiveValue);
    }

    // Update organization if there are changes
    if (updates.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE organizations SET ${updates.join(", ")} WHERE id = ?`,
        params
      );
    }

    // Fetch updated organization
    const [[updatedOrganization]] = await pool.query(
      "SELECT id, code, name, logo_url, is_active, created_at, updated_at FROM organizations WHERE id = ?",
      [id]
    );

    // Format response with required fields (supporting both naming conventions)
    const response = {
      id: updatedOrganization.id,
      organization_code: updatedOrganization.code,
      code: updatedOrganization.code,
      organization_name: updatedOrganization.name,
      name: updatedOrganization.name,
      logo_url: updatedOrganization.logo_url || null,
      logo: updatedOrganization.logo_url || null,
      is_active: updatedOrganization.is_active === 1,
      created_at: updatedOrganization.created_at,
      updated_at: updatedOrganization.updated_at,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
