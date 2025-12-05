// util/cacheUtil.js
const { redisClient, isRedisConnected } = require('./redisClient');

/**
 * Cache keys prefix constants
 */
const CACHE_PREFIXES = {
  ORGANIZATION: 'org',
  FINANCIAL_YEAR: 'fy',
  DEPARTMENT: 'dept',
  LOCATION: 'loc',
  EMPLOYEE: 'emp',
  USER: 'user',
  CALENDAR: 'cal',
  HOLIDAY: 'holiday',
};

/**
 * Get cached data
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Cached data or null
 */
async function getCache(key) {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const data = await redisClient.get(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error(`Cache GET error for key ${key}:`, error.message);
    return null; // Graceful degradation - return null on error
  }
}

/**
 * Set cache data
 * @param {string} key - Cache key
 * @param {any} value - Data to cache
 * @param {number} ttl - Time to live in seconds (default: 3600 = 1 hour)
 * @returns {Promise<boolean>} - Success status
 */
async function setCache(key, value, ttl = 3600) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    await redisClient.setEx(key, ttl, serialized);
    return true;
  } catch (error) {
    console.error(`Cache SET error for key ${key}:`, error.message);
    return false; // Graceful degradation
  }
}

/**
 * Delete cache by key
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Success status
 */
async function deleteCache(key) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error(`Cache DELETE error for key ${key}:`, error.message);
    return false;
  }
}

/**
 * Delete multiple cache keys by pattern
 * @param {string} pattern - Pattern to match (e.g., 'org:*')
 * @returns {Promise<number>} - Number of keys deleted
 */
async function deleteCacheByPattern(pattern) {
  if (!isRedisConnected()) {
    return 0;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      return await redisClient.del(keys);
    }
    return 0;
  } catch (error) {
    console.error(`Cache DELETE pattern error for ${pattern}:`, error.message);
    return 0;
  }
}

/**
 * Invalidate organization cache
 * @param {string} orgid - Organization ID (optional)
 */
async function invalidateOrganizationCache(orgid = null) {
  if (orgid) {
    await deleteCache(`${CACHE_PREFIXES.ORGANIZATION}:${orgid}`);
  }
  await deleteCacheByPattern(`${CACHE_PREFIXES.ORGANIZATION}:*`);
}

/**
 * Invalidate financial year caches
 * @param {string} id - Financial year ID (optional)
 */
async function invalidateFinancialYearCache(id = null) {
  if (id) {
    await deleteCache(`${CACHE_PREFIXES.FINANCIAL_YEAR}:${id}`);
  }
  await deleteCache(`${CACHE_PREFIXES.FINANCIAL_YEAR}:current`);
  await deleteCacheByPattern(`${CACHE_PREFIXES.FINANCIAL_YEAR}:list:*`);
  await deleteCacheByPattern(`${CACHE_PREFIXES.FINANCIAL_YEAR}:*`);
}

/**
 * Invalidate department caches
 * @param {string} deptid - Department ID (optional)
 */
async function invalidateDepartmentCache(deptid = null) {
  if (deptid) {
    await deleteCache(`${CACHE_PREFIXES.DEPARTMENT}:${deptid.toUpperCase()}`);
  }
  await deleteCache(`${CACHE_PREFIXES.DEPARTMENT}:all`);
  await deleteCacheByPattern(`${CACHE_PREFIXES.DEPARTMENT}:*`);
}

/**
 * Invalidate location caches
 * @param {string} locationId - Location ID (optional)
 */
async function invalidateLocationCache(locationId = null) {
  if (locationId) {
    await deleteCache(`${CACHE_PREFIXES.LOCATION}:${locationId}`);
  }
  await deleteCache(`${CACHE_PREFIXES.LOCATION}:all`);
  await deleteCacheByPattern(`${CACHE_PREFIXES.LOCATION}:*`);
}

/**
 * Invalidate employee-related caches
 * @param {string} empid - Employee ID (optional)
 */
async function invalidateEmployeeCache(empid = null) {
  if (empid) {
    await deleteCacheByPattern(`${CACHE_PREFIXES.EMPLOYEE}:${empid}:*`);
  }
  await deleteCacheByPattern(`${CACHE_PREFIXES.EMPLOYEE}:search:*`);
  await deleteCacheByPattern(`${CACHE_PREFIXES.EMPLOYEE}:*`);
}

/**
 * Invalidate user-related caches
 * @param {string} username - Username (optional)
 * @param {string} empid - Employee ID (optional, for invalidating by empid)
 */
async function invalidateUserCache(username = null, empid = null) {
  if (username) {
    await deleteCache(`${CACHE_PREFIXES.USER}:${username}`);
  }
  if (empid) {
    await deleteCacheByPattern(`${CACHE_PREFIXES.USER}:empid:${empid}:*`);
  }
  await deleteCacheByPattern(`${CACHE_PREFIXES.USER}:list:*`);
  await deleteCacheByPattern(`${CACHE_PREFIXES.USER}:*`);
}

/**
 * Invalidate calendar-related caches
 * @param {string} calendarId - Calendar ID (optional)
 * @param {string} calendarType - Calendar type (ORGANIZATION, LOCATION, DEPARTMENT, EMPLOYEE) (optional)
 * @param {string} locationId - Location ID (optional, for location calendars)
 * @param {string} departmentId - Department ID (optional, for department calendars)
 */
async function invalidateCalendarCache(calendarId = null, calendarType = null, locationId = null, departmentId = null) {
  if (calendarId) {
    await deleteCache(`${CACHE_PREFIXES.CALENDAR}:${calendarId}`);
    await deleteCacheByPattern(`${CACHE_PREFIXES.CALENDAR}:${calendarId}:*`);
  }
  
  // Invalidate monthly calendar caches based on type
  if (calendarType === 'ORGANIZATION') {
    await deleteCacheByPattern(`${CACHE_PREFIXES.CALENDAR}:monthly:organization:*`);
  } else if (calendarType === 'LOCATION' && locationId) {
    await deleteCacheByPattern(`${CACHE_PREFIXES.CALENDAR}:monthly:location:${locationId}:*`);
  } else if (calendarType === 'DEPARTMENT' && departmentId) {
    await deleteCacheByPattern(`${CACHE_PREFIXES.CALENDAR}:monthly:department:${departmentId}:*`);
  }
  
  // Invalidate all monthly calendar caches if no specific type
  if (!calendarType) {
    await deleteCacheByPattern(`${CACHE_PREFIXES.CALENDAR}:monthly:*`);
  }
  
  await deleteCacheByPattern(`${CACHE_PREFIXES.CALENDAR}:list:*`);
}

/**
 * Invalidate holiday-related caches
 * @param {string} calendarId - Calendar ID (optional)
 * @param {string} holidayId - Holiday ID (optional)
 */
async function invalidateHolidayCache(calendarId = null, holidayId = null) {
  if (holidayId) {
    await deleteCache(`${CACHE_PREFIXES.HOLIDAY}:${holidayId}`);
  }
  if (calendarId) {
    await deleteCacheByPattern(`${CACHE_PREFIXES.HOLIDAY}:calendar:${calendarId}:*`);
  }
  await deleteCacheByPattern(`${CACHE_PREFIXES.HOLIDAY}:*`);
}

/**
 * Cache wrapper middleware - wraps async function with cache logic
 * @param {Function} fetchFn - Function to fetch data if cache miss
 * @param {string} cacheKey - Cache key
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>} - Cached or fresh data
 */
async function withCache(fetchFn, cacheKey, ttl = 3600) {
  // Try to get from cache
  const cached = await getCache(cacheKey);
  if (cached !== null) {
    console.log(`Cache hit for ${cacheKey}`);
    return cached;
  }

  // Cache miss - fetch fresh data
  const freshData = await fetchFn();

  // Store in cache (don't await - fire and forget for performance)
  setCache(cacheKey, freshData, ttl).catch((err) => {
    console.error(`Failed to cache ${cacheKey}:`, err.message);
  });

  console.log(`Cache miss for ${cacheKey}`);
  return freshData;
}

module.exports = {
  getCache,
  setCache,
  deleteCache,
  deleteCacheByPattern,
  invalidateOrganizationCache,
  invalidateFinancialYearCache,
  invalidateDepartmentCache,
  invalidateLocationCache,
  invalidateEmployeeCache,
  invalidateUserCache,
  invalidateCalendarCache,
  invalidateHolidayCache,
  withCache,
  CACHE_PREFIXES,
};

