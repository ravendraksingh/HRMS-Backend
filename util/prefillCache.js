// util/prefillCache.js
// Pre-fill cache with frequently accessed, rarely changing data at server startup

const pool = require('../db');
const { setCache, CACHE_PREFIXES } = require('./cacheUtil');
const { isRedisConnected } = require('./redisClient');
const { SELECT_ALL_LOCATIONS } = require('../queries/locations');
const { SELECT_ALL_DEPARTMENTS } = require('../queries/departments');

/**
 * Pre-fill cache with organization data
 */
async function prefillOrganizations() {
  try {
    const [organizations] = await pool.query(
      'SELECT orgid, name, short_name, logo_url, is_active FROM organization ORDER BY name ASC'
    );

    // Cache each organization individually
    for (const org of organizations) {
      const cacheKey = `${CACHE_PREFIXES.ORGANIZATION}:${org.orgid}`;
      await setCache(cacheKey, org, 86400); // 24 hours TTL
    }

    console.log(`✅ Pre-filled ${organizations.length} organization(s) into cache`);
    return organizations.length;
  } catch (error) {
    console.error('❌ Error pre-filling organizations:', error.message);
    return 0;
  }
}

/**
 * Pre-fill cache with department data
 */
async function prefillDepartments() {
  try {
    const [departments] = await pool.query(SELECT_ALL_DEPARTMENTS);

    // Cache all departments list (route caches the array, not wrapped)
    const allCacheKey = `${CACHE_PREFIXES.DEPARTMENT}:all`;
    await setCache(allCacheKey, departments, 86400); // 24 hours TTL

    // Cache each department individually
    for (const dept of departments) {
      const cacheKey = `${CACHE_PREFIXES.DEPARTMENT}:${dept.deptid.toUpperCase()}`;
      await setCache(cacheKey, dept, 86400); // 24 hours TTL
    }

    console.log(`✅ Pre-filled ${departments.length} department(s) into cache`);
    return departments.length;
  } catch (error) {
    console.error('❌ Error pre-filling departments:', error.message);
    return 0;
  }
}

/**
 * Pre-fill cache with location data
 */
async function prefillLocations() {
  try {
    const [locations] = await pool.query(SELECT_ALL_LOCATIONS);

    // Cache all locations list (route caches the array, not wrapped)
    const allCacheKey = `${CACHE_PREFIXES.LOCATION}:all`;
    await setCache(allCacheKey, locations, 86400); // 24 hours TTL

    // Cache each location individually
    for (const location of locations) {
      const cacheKey = `${CACHE_PREFIXES.LOCATION}:${location.id}`;
      await setCache(cacheKey, location, 86400); // 24 hours TTL
    }

    console.log(`✅ Pre-filled ${locations.length} location(s) into cache`);
    return locations.length;
  } catch (error) {
    console.error('❌ Error pre-filling locations:', error.message);
    return 0;
  }
}

/**
 * Pre-fill cache with financial year data
 */
async function prefillFinancialYears() {
  try {
    // Get all active financial years
    const [financialYears] = await pool.query(
      `SELECT 
        id,
        financial_year,
        DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
        is_current,
        is_active,
        description
      FROM financial_years
      WHERE is_active = 'Y'
      ORDER BY start_date DESC`
    );

    // Cache all active financial years list
    const listCacheKey = `${CACHE_PREFIXES.FINANCIAL_YEAR}:list`;
    await setCache(
      listCacheKey,
      { financial_years: financialYears },
      86400
    ); // 24 hours TTL

    // Cache each financial year individually
    for (const fy of financialYears) {
      const cacheKey = `${CACHE_PREFIXES.FINANCIAL_YEAR}:${fy.id}`;
      await setCache(cacheKey, fy, 86400); // 24 hours TTL
    }

    // Cache current financial year
    const currentFY = financialYears.find((fy) => fy.is_current === 'Y');
    if (currentFY) {
      const currentCacheKey = `${CACHE_PREFIXES.FINANCIAL_YEAR}:current`;
      await setCache(currentCacheKey, currentFY, 86400); // 24 hours TTL
      console.log(`✅ Pre-filled current financial year: ${currentFY.financial_year}`);
    }

    console.log(`✅ Pre-filled ${financialYears.length} financial year(s) into cache`);
    return financialYears.length;
  } catch (error) {
    console.error('❌ Error pre-filling financial years:', error.message);
    return 0;
  }
}

/**
 * Pre-fill cache with organization calendars for current financial year
 */
async function prefillCalendars() {
  try {
    // Get current financial year
    const [[currentFY]] = await pool.query(
      `SELECT financial_year 
       FROM financial_years 
       WHERE is_current = 'Y' 
       LIMIT 1`
    );

    if (!currentFY) {
      console.log('⚠️  No current financial year found, skipping calendar pre-fill');
      return 0;
    }

    const financialYear = currentFY.financial_year;

    // Get organization calendars for current financial year
    const [calendars] = await pool.query(
      `SELECT 
        id,
        calendar_name,
        calendar_type,
        location_id,
        department_id,
        empid,
        financial_year,
        is_active,
        description,
        created_by
      FROM attendance_calendars
      WHERE calendar_type = 'ORGANIZATION' 
        AND financial_year = ? 
        AND is_active = 'Y'
      ORDER BY calendar_name ASC`,
      [financialYear]
    );

    // Cache each organization calendar
    for (const calendar of calendars) {
      const cacheKey = `${CACHE_PREFIXES.CALENDAR}:${calendar.id}`;
      await setCache(cacheKey, calendar, 86400); // 24 hours TTL
    }

    // Cache calendar list for organization type
    const listCacheKey = `${CACHE_PREFIXES.CALENDAR}:list:ORGANIZATION:${financialYear}`;
    await setCache(listCacheKey, calendars, 86400); // 24 hours TTL

    console.log(
      `✅ Pre-filled ${calendars.length} organization calendar(s) for FY ${financialYear} into cache`
    );
    return calendars.length;
  } catch (error) {
    console.error('❌ Error pre-filling calendars:', error.message);
    return 0;
  }
}

/**
 * Pre-fill all cache data at server startup
 * This function loads frequently accessed, rarely changing data into Redis cache
 */
async function prefillCache() {
  // Check if Redis is connected
  if (!isRedisConnected()) {
    console.log('⚠️  Redis not connected, skipping cache pre-fill');
    return;
  }

  console.log('🔄 Starting cache pre-fill...');

  try {
    const results = {
      organizations: 0,
      departments: 0,
      locations: 0,
      financialYears: 0,
      calendars: 0,
    };

    // Pre-fill in parallel for better performance
    const [
      orgCount,
      deptCount,
      locCount,
      fyCount,
      calCount,
    ] = await Promise.all([
      prefillOrganizations(),
      prefillDepartments(),
      prefillLocations(),
      prefillFinancialYears(),
      prefillCalendars(),
    ]);

    results.organizations = orgCount;
    results.departments = deptCount;
    results.locations = locCount;
    results.financialYears = fyCount;
    results.calendars = calCount;

    const total = Object.values(results).reduce((sum, count) => sum + count, 0);
    console.log(`✅ Cache pre-fill completed. Total items cached: ${total}`);
    console.log(`   - Organizations: ${results.organizations}`);
    console.log(`   - Departments: ${results.departments}`);
    console.log(`   - Locations: ${results.locations}`);
    console.log(`   - Financial Years: ${results.financialYears}`);
    console.log(`   - Calendars: ${results.calendars}`);

    return results;
  } catch (error) {
    console.error('❌ Error during cache pre-fill:', error.message);
    throw error;
  }
}

module.exports = {
  prefillCache,
  prefillOrganizations,
  prefillDepartments,
  prefillLocations,
  prefillFinancialYears,
  prefillCalendars,
};

