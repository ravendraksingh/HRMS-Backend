const { body, param } = require("express-validator");
const {
  dateValidator,
  emailValidator,
  phoneValidator,
  genderValidator,
  yesNoValidator,
  integerIdValidator,
} = require("./commonValidators");

// ============================================
// EMPLOYEE FIELD VALIDATORS
// ============================================

/**
 * Employee ID validator (for body)
 */
const empidValidator = (field = "empid") =>
  body(field).notEmpty().withMessage(`${field} is required`).trim();

/**
 * Employee ID validator (for params)
 */
const empidParamValidator = param("empid")
  .notEmpty()
  .withMessage("Employee ID is required")
  .trim();

// ============================================
// EMPLOYEE PERSONAL DETAILS VALIDATION SCHEMAS
// ============================================

/**
 * Schema for updating employee personal details
 */
const updatePersonalDetailsSchema = [
  empidParamValidator,
  phoneValidator("phone", false),
  phoneValidator("alternate_phone", false),
  dateValidator("date_of_birth", false),
  genderValidator("gender", false),
  body("marital_status")
    .optional()
    .isIn(["Single", "Married", "Divorced", "Widowed"])
    .withMessage("marital_status must be Single/Married/Divorced/Widowed")
    .trim(),
  body("blood_group")
    .optional()
    .isIn(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .withMessage("blood_group must be a valid blood type")
    .trim(),
  body("emergency_contact_name").optional().trim(),
  phoneValidator("emergency_contact_phone", false),
  body("emergency_contact_relation").optional().trim(),
  body("permanent_address_line1").optional().trim(),
  body("permanent_address_line2").optional().trim(),
  body("permanent_city").optional().trim(),
  body("permanent_state").optional().trim(),
  body("permanent_postal_code").optional().trim(),
  body("permanent_country").optional().trim(),
  body("current_address_line1").optional().trim(),
  body("current_address_line2").optional().trim(),
  body("current_city").optional().trim(),
  body("current_state").optional().trim(),
  body("current_postal_code").optional().trim(),
  body("current_country").optional().trim(),
  body("pan_number")
    .optional()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage("pan_number must be in format ABCDE1234F")
    .trim()
    .toUpperCase(),
  body("aadhaar_number")
    .optional()
    .matches(/^[0-9]{12}$/)
    .withMessage("aadhaar_number must be 12 digits")
    .trim(),
  body("passport_number").optional().trim(),
  dateValidator("passport_expiry", false),
  body("driving_license_number").optional().trim(),
  dateValidator("driving_license_expiry", false),
];

// ============================================
// EMPLOYEE JOB INFORMATION VALIDATION SCHEMAS
// ============================================

/**
 * Schema for creating/updating employee job information
 */
const createUpdateJobInformationSchema = [
  empidParamValidator,
  body("job_title").notEmpty().withMessage("job_title is required").trim(),
  body("employment_type")
    .optional()
    .isIn(["full_time", "part_time", "contract", "intern", "consultant"])
    .withMessage(
      "employment_type must be full_time/part_time/contract/intern/consultant"
    )
    .trim(),
  body("employment_status")
    .optional()
    .isIn(["active", "inactive", "terminated", "resigned", "on_leave"])
    .withMessage(
      "employment_status must be active/inactive/terminated/resigned/on_leave"
    )
    .trim(),
  dateValidator("date_of_joining", true),
  dateValidator("probation_start_date", false),
  dateValidator("probation_end_date", false),
  body("probation_status")
    .optional()
    .isIn(["pending", "completed", "extended", "terminated"])
    .withMessage(
      "probation_status must be pending/completed/extended/terminated"
    )
    .trim(),
  dateValidator("confirmation_date", false),
  integerIdValidator("shiftid", false),
  body("cost_center").optional().trim(),
  body("employee_category").optional().trim(),
  body("grade").optional().trim(),
  body("level").optional().trim(),
];

/**
 * Schema for creating job history entry
 */
const createJobHistorySchema = [
  empidParamValidator,
  body("new_job_title")
    .notEmpty()
    .withMessage("new_job_title is required")
    .trim(),
  body("change_type")
    .notEmpty()
    .withMessage("change_type is required")
    .isIn(["promotion", "transfer", "demotion", "lateral_move", "role_change"])
    .withMessage(
      "change_type must be promotion/transfer/demotion/lateral_move/role_change"
    )
    .trim(),
  dateValidator("effective_date", true),
  body("previous_job_title").optional().trim(),
  integerIdValidator("previous_department_id", false),
  integerIdValidator("new_department_id", false),
  body("previous_manager_id").optional().trim(),
  body("new_manager_id").optional().trim(),
  body("reason").optional().trim(),
  body("notes").optional().trim(),
];

// ============================================
// EMPLOYEE EDUCATION VALIDATION SCHEMAS
// ============================================

/**
 * Schema for creating educational detail
 */
const createEducationSchema = [
  empidParamValidator,
  body("qualification_type")
    .notEmpty()
    .withMessage("qualification_type is required")
    .isIn([
      "High School",
      "Diploma",
      "Bachelor",
      "Master",
      "PhD",
      "Certificate",
      "Other",
    ])
    .withMessage(
      "qualification_type must be High School/Diploma/Bachelor/Master/PhD/Certificate/Other"
    )
    .trim(),
  body("institution_name")
    .notEmpty()
    .withMessage("institution_name is required")
    .trim(),
  body("degree").optional().trim(),
  body("specialization").optional().trim(),
  body("university_board").optional().trim(),
  dateValidator("start_date", false),
  dateValidator("end_date", false),
  body("percentage")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("percentage must be between 0 and 100")
    .toFloat(),
  body("cgpa")
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage("cgpa must be between 0 and 10")
    .toFloat(),
  body("grade").optional().trim(),
];

/**
 * Schema for updating educational detail
 */
const updateEducationSchema = [
  empidParamValidator,
  param("id")
    .notEmpty()
    .withMessage("id is required")
    .isInt({ min: 1 })
    .withMessage("id must be a positive integer")
    .toInt(),
  body("qualification_type")
    .optional()
    .isIn([
      "High School",
      "Diploma",
      "Bachelor",
      "Master",
      "PhD",
      "Certificate",
      "Other",
    ])
    .withMessage(
      "qualification_type must be High School/Diploma/Bachelor/Master/PhD/Certificate/Other"
    )
    .trim(),
  body("institution_name").optional().trim(),
  body("degree").optional().trim(),
  body("specialization").optional().trim(),
  body("university_board").optional().trim(),
  dateValidator("start_date", false),
  dateValidator("end_date", false),
  body("percentage")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("percentage must be between 0 and 100")
    .toFloat(),
  body("cgpa")
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage("cgpa must be between 0 and 10")
    .toFloat(),
  body("grade").optional().trim(),
  body("is_verified")
    .optional()
    .isBoolean()
    .withMessage("is_verified must be a boolean")
    .toBoolean(),
  body("verified_by").optional().trim(),
];

// ============================================
// EMPLOYEE FAMILY VALIDATION SCHEMAS
// ============================================

/**
 * Schema for creating family/dependent record
 */
const createFamilySchema = [
  empidParamValidator,
  body("relationship")
    .notEmpty()
    .withMessage("relationship is required")
    .isIn(["Spouse", "Child", "Parent", "Sibling", "Other"])
    .withMessage("relationship must be Spouse/Child/Parent/Sibling/Other")
    .trim(),
  body("name").notEmpty().withMessage("name is required").trim(),
  dateValidator("date_of_birth", false),
  genderValidator("gender", false),
  yesNoValidator("is_dependent", false),
  body("occupation").optional().trim(),
  body("employer_name").optional().trim(),
  phoneValidator("phone", false),
  emailValidator("email", false),
  body("aadhaar_number")
    .optional()
    .matches(/^[0-9]{12}$/)
    .withMessage("aadhaar_number must be 12 digits")
    .trim(),
  body("pan_number")
    .optional()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage("pan_number must be in format ABCDE1234F")
    .trim()
    .toUpperCase(),
  body("passport_number").optional().trim(),
  dateValidator("passport_expiry", false),
  yesNoValidator("is_covered_under_insurance", false),
  body("insurance_policy_number").optional().trim(),
  body("address_line1").optional().trim(),
  body("address_line2").optional().trim(),
  body("city").optional().trim(),
  body("state").optional().trim(),
  body("postal_code").optional().trim(),
  body("country").optional().trim(),
  yesNoValidator("is_emergency_contact", false),
  body("notes").optional().trim(),
];

/**
 * Schema for updating family/dependent record
 */
const updateFamilySchema = [
  empidParamValidator,
  param("id")
    .notEmpty()
    .withMessage("id is required")
    .isInt({ min: 1 })
    .withMessage("id must be a positive integer")
    .toInt(),
  body("relationship")
    .optional()
    .isIn(["Spouse", "Child", "Parent", "Sibling", "Other"])
    .withMessage("relationship must be Spouse/Child/Parent/Sibling/Other")
    .trim(),
  body("name").optional().trim(),
  dateValidator("date_of_birth", false),
  genderValidator("gender", false),
  yesNoValidator("is_dependent", false),
  body("occupation").optional().trim(),
  body("employer_name").optional().trim(),
  phoneValidator("phone", false),
  emailValidator("email", false),
  body("aadhaar_number")
    .optional()
    .matches(/^[0-9]{12}$/)
    .withMessage("aadhaar_number must be 12 digits")
    .trim(),
  body("pan_number")
    .optional()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage("pan_number must be in format ABCDE1234F")
    .trim()
    .toUpperCase(),
  body("passport_number").optional().trim(),
  dateValidator("passport_expiry", false),
  yesNoValidator("is_covered_under_insurance", false),
  body("insurance_policy_number").optional().trim(),
  body("address_line1").optional().trim(),
  body("address_line2").optional().trim(),
  body("city").optional().trim(),
  body("state").optional().trim(),
  body("postal_code").optional().trim(),
  body("country").optional().trim(),
  yesNoValidator("is_emergency_contact", false),
  body("notes").optional().trim(),
];

module.exports = {
  // Individual validators
  empidValidator,
  empidParamValidator,

  // Employee personal details schemas
  updatePersonalDetailsSchema,

  // Employee job information schemas
  createUpdateJobInformationSchema,
  createJobHistorySchema,

  // Employee education schemas
  createEducationSchema,
  updateEducationSchema,

  // Employee family schemas
  createFamilySchema,
  updateFamilySchema,
};

