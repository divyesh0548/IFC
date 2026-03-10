/**
 * Utility functions for calculating sample_required dates based on control_frequency
 */

/**
 * Generate a list of all dates for 2024, 2025, and 2026 (excluding weekends)
 * @returns {Date[]} Array of Date objects (weekdays only)
 */
function generateWeekdayDates() {
  const dates = [];
  const startYear = 2024;
  const endYear = 2026;
  
  for (let year = startYear; year <= endYear; year++) {
    const startDate = new Date(year, 0, 1); // January 1st
    const endDate = new Date(year, 11, 31); // December 31st
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      // Exclude weekends: 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(new Date(date));
      }
    }
  }
  
  return dates;
}

/**
 * Check if a date is a weekday (Monday-Friday)
 * @param {Date} date - The date to check
 * @returns {boolean} True if weekday, false otherwise
 */
function isWeekday(date) {
  const dayOfWeek = date.getDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Get all weekdays within a date range
 * @param {Date} startDate - Start date (inclusive)
 * @param {Date} endDate - End date (inclusive)
 * @returns {Date[]} Array of weekday Date objects
 */
function getWeekdaysInRange(startDate, endDate) {
  const weekdays = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  while (currentDate <= end) {
    if (isWeekday(currentDate)) {
      weekdays.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return weekdays;
}

/**
 * Format date to YYYY-MM-DD string
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date to DD-MM-YYYY string
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string
 */
function formatDateDDMMYYYY(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}-${month}-${year}`;
}

/**
 * Get the first weekday of a month
 * @param {number} year - Year
 * @param {number} month - Month (0-11, where 0 = January)
 * @returns {Date} First weekday of the month
 */
function getFirstWeekdayOfMonth(year, month) {
  const firstDay = new Date(year, month, 1);
  while (!isWeekday(firstDay)) {
    firstDay.setDate(firstDay.getDate() + 1);
  }
  return firstDay;
}

/**
 * Get the last weekday of a month
 * @param {number} year - Year
 * @param {number} month - Month (0-11, where 0 = January)
 * @returns {Date} Last weekday of the month
 */
function getLastWeekdayOfMonth(year, month) {
  // Get the last day of the month
  const lastDay = new Date(year, month + 1, 0);
  // Go backwards until we find a weekday
  while (!isWeekday(lastDay)) {
    lastDay.setDate(lastDay.getDate() - 1);
  }
  return lastDay;
}

/**
 * Get quarter information based on month
 * @param {number} month - Month (0-11, where 0 = January)
 * @returns {Object} Object with quarter number and start/end months
 */
function getQuarterInfo(month) {
  // Quarters: Q1 (Jan-Mar: 0-2), Q2 (Apr-Jun: 3-5), Q3 (Jul-Sep: 6-8), Q4 (Oct-Dec: 9-11)
  if (month >= 0 && month <= 2) {
    return { quarter: 1, startMonth: 0, endMonth: 2 }; // Jan-Mar
  } else if (month >= 3 && month <= 5) {
    return { quarter: 2, startMonth: 3, endMonth: 5 }; // Apr-Jun
  } else if (month >= 6 && month <= 8) {
    return { quarter: 3, startMonth: 6, endMonth: 8 }; // Jul-Sep
  } else {
    return { quarter: 4, startMonth: 9, endMonth: 11 }; // Oct-Dec
  }
}

/**
 * Get quarter information by quarter number
 * @param {number} quarter - Quarter number (1-4)
 * @returns {Object} Object with start/end months
 */
function getQuarterInfoByQuarter(quarter) {
  switch (quarter) {
    case 1:
      return { startMonth: 0, endMonth: 2 }; // Jan-Mar
    case 2:
      return { startMonth: 3, endMonth: 5 }; // Apr-Jun
    case 3:
      return { startMonth: 6, endMonth: 8 }; // Jul-Sep
    case 4:
      return { startMonth: 9, endMonth: 11 }; // Oct-Dec
    default:
      throw new Error(`Invalid quarter: ${quarter}`);
  }
}

/**
 * Calculate sample_required date based on control_frequency and created_at
 * @param {string} controlFrequency - The control frequency value (e.g., 'yearly', 'quarterly', etc.)
 * @param {Date|string} createdAt - The created_at timestamp of the control form
 * @returns {string|null} Formatted date string (YYYY-MM-DD) or null if frequency is not supported
 */
function getSampleSizeByFrequency(controlFrequency) {
  if (!controlFrequency) {
    return null;
  }

  const normalizedFreq = String(controlFrequency)
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalizedFreq === 'yearly') {
    return 1;
  }

  if (normalizedFreq === 'half yearly') {
    return 2;
  }

  if (normalizedFreq === 'monthly') {
    return 3;
  }

  if (normalizedFreq === 'weekly') {
    return 8;
  }

  if (normalizedFreq === 'fortnightly' || normalizedFreq.includes('fortnight')) {
    return 4;
  }

  if (
    (normalizedFreq === 'as and when needed') ||
    (normalizedFreq.includes('as') && normalizedFreq.includes('when') && (normalizedFreq.includes('needed') || normalizedFreq.includes('required')))
  ) {
    return 5;
  }

  if (
    (normalizedFreq === 'recurring and periodic') ||
    (normalizedFreq.includes('recurring') && (normalizedFreq.includes('periodic') || normalizedFreq.includes('daily')))
  ) {
    return 40;
  }

  return null;
}

function calculateSampleRequired(controlFrequency, createdAt) {
  if (!controlFrequency || !createdAt) {
    console.log('[sample_required] Missing controlFrequency or createdAt:', { controlFrequency, createdAt });
    return null;
  }
  
  // Normalize control_frequency to lowercase for comparison (handle all case variations)
  // Also replace "&" with "and" for consistent matching
  const frequency = String(controlFrequency).toLowerCase().trim();
  const normalizedFreq = frequency.replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
  console.log('[sample_required] Normalized frequency:', frequency, 'normalized (no &):', normalizedFreq, 'from original:', controlFrequency);
  
  // Parse created_at to Date object if it's a string
  let createdDate;
  if (createdAt instanceof Date) {
    createdDate = new Date(createdAt);
  } else {
    createdDate = new Date(createdAt);
  }
  
  // Validate date
  if (isNaN(createdDate.getTime())) {
    console.error('[sample_required] Invalid created_at date:', createdAt);
    return null;
  }
  
  console.log('[sample_required] Processing frequency:', frequency, 'for date:', createdDate);
  
  // For 'yearly' frequency
  if (frequency === 'yearly') {
    // Get the year from created_at
    const createdYear = createdDate.getFullYear();
    // Calculate previous year
    const previousYear = createdYear - 1;
    
    // Only allow years 2024, 2025, or 2026
    if (previousYear >= 2024 && previousYear <= 2026) {
      return String(previousYear);
    }
    
    // If previous year is outside the valid range, return null
    console.warn(`Previous year ${previousYear} is outside valid range (2024-2026)`);
    return null;
  }
  
  // For 'quarterly' frequency (handle variations: quarterly, Quarterly, QUARTERLY, etc.)
  // Since we already normalized to lowercase, check for exact match or contains 'quarter'
  if (frequency === 'quarterly' || frequency.includes('quarter')) {
    console.log('[sample_required] Processing quarterly frequency');
    const createdYear = createdDate.getFullYear();
    const createdMonth = createdDate.getMonth(); // 0-11
    
    console.log('[sample_required] Created date - Year:', createdYear, 'Month:', createdMonth + 1);
    
    // Get current quarter info
    const currentQuarter = getQuarterInfo(createdMonth);
    console.log('[sample_required] Current quarter:', currentQuarter);
    
    let interval1Quarter, interval1Year, interval2Quarter, interval2Year;
    
    // Determine the two intervals based on current quarter
    // If created_at is in Q2 (Apr-Jun), show Q4 of previous year and Q1 of current year
    // If created_at is in Q3 (Jul-Sep), show Q1 and Q2 of current year
    // If created_at is in Q4 (Oct-Dec), show Q2 and Q3 of current year
    // If created_at is in Q1 (Jan-Mar), show Q3 and Q4 of previous year
    if (currentQuarter.quarter === 1) {
      // Q1: show Q3 and Q4 of previous year
      interval1Quarter = 3;
      interval1Year = createdYear - 1;
      interval2Quarter = 4;
      interval2Year = createdYear - 1;
    } else if (currentQuarter.quarter === 2) {
      // Q2: show Q4 of previous year and Q1 of current year
      interval1Quarter = 4;
      interval1Year = createdYear - 1;
      interval2Quarter = 1;
      interval2Year = createdYear;
    } else if (currentQuarter.quarter === 3) {
      // Q3: show Q1 and Q2 of current year
      interval1Quarter = 1;
      interval1Year = createdYear;
      interval2Quarter = 2;
      interval2Year = createdYear;
    } else {
      // Q4: show Q2 and Q3 of current year
      interval1Quarter = 2;
      interval1Year = createdYear;
      interval2Quarter = 3;
      interval2Year = createdYear;
    }
    
    console.log('[sample_required] Calculated intervals - Interval1: Q' + interval1Quarter + ' ' + interval1Year + ', Interval2: Q' + interval2Quarter + ' ' + interval2Year);
    
    // Check if years are within valid range (2024-2026)
    if (interval1Year < 2024 || interval1Year > 2026 || interval2Year < 2024 || interval2Year > 2026) {
      console.warn(`[sample_required] Years outside valid range (2024-2026): interval1Year=${interval1Year}, interval2Year=${interval2Year}`);
      return null;
    }
    
    // Get quarter info for both intervals
    const interval1Info = getQuarterInfoByQuarter(interval1Quarter);
    const interval2Info = getQuarterInfoByQuarter(interval2Quarter);
    
    console.log('[sample_required] Interval1 info:', interval1Info, 'Interval2 info:', interval2Info);
    
    // Get first weekday of interval 1's start month and last weekday of interval 1's end month
    const interval1StartDate = getFirstWeekdayOfMonth(interval1Year, interval1Info.startMonth);
    const interval1EndDate = getLastWeekdayOfMonth(interval1Year, interval1Info.endMonth);
    
    // Get first weekday of interval 2's start month and last weekday of interval 2's end month
    const interval2StartDate = getFirstWeekdayOfMonth(interval2Year, interval2Info.startMonth);
    const interval2EndDate = getLastWeekdayOfMonth(interval2Year, interval2Info.endMonth);
    
    console.log('[sample_required] Interval1 dates:', interval1StartDate, 'to', interval1EndDate);
    console.log('[sample_required] Interval2 dates:', interval2StartDate, 'to', interval2EndDate);
    
    // Format intervals: "dd-mm-yyyy to dd-mm-yyyy, dd-mm-yyyy to dd-mm-yyyy"
    const interval1Str = `${formatDateDDMMYYYY(interval1StartDate)} to ${formatDateDDMMYYYY(interval1EndDate)}`;
    const interval2Str = `${formatDateDDMMYYYY(interval2StartDate)} to ${formatDateDDMMYYYY(interval2EndDate)}`;
    
    const result = `${interval1Str}, ${interval2Str}`;
    console.log('[sample_required] Final quarterly result:', result);
    return result;
  }
  
  // For 'half yearly' frequency (handle variations: half yearly, half-yearly, Half Yearly, etc.)
  // Since we already normalized to lowercase, check for variations
  if (frequency === 'half yearly' || frequency === 'half-yearly' || frequency.includes('half') && frequency.includes('year')) {
    console.log('[sample_required] Processing half yearly frequency');
    const createdYear = createdDate.getFullYear();
    const createdMonth = createdDate.getMonth(); // 0-11
    const createdDay = createdDate.getDate();
    
    console.log('[sample_required] Created date - Year:', createdYear, 'Month:', createdMonth + 1, 'Day:', createdDay);
    
    let interval1StartMonth, interval1EndMonth, interval1Year, interval2StartMonth, interval2EndMonth, interval2Year;
    
    // Determine the two intervals based on current half year
    // Half year 1: Jan-Jun (months 0-5, ends June 30)
    // Half year 2: Jul-Dec (months 6-11, ends December 31)
    // We need to show the last 2 complete half-year intervals that end before or on created_at date
    // If created_at is in Jan-Jun, the current year's first half ends on June 30, which is after created_at
    // So we need to go back to previous year's two halves
    // If created_at is in Jul-Dec, the current year's second half ends on Dec 31, which may be after created_at
    // So we need to check if we can include it, or go back to previous year's second half
    
    if (createdMonth >= 0 && createdMonth <= 5) {
      // First half (Jan-Jun): current year's first half ends on June 30, which is after created_at
      // So show previous year's two complete halves
      // Interval 1: Previous year's first half (Jan-Jun)
      interval1StartMonth = 0; // January
      interval1EndMonth = 5; // June
      interval1Year = createdYear - 1;
      // Interval 2: Previous year's second half (Jul-Dec)
      interval2StartMonth = 6; // July
      interval2EndMonth = 11; // December
      interval2Year = createdYear - 1;
    } else {
      // Second half (Jul-Dec): check if current year's second half is complete
      // Current year's second half ends on December 31
      // If created_at is before or on Dec 31, we can include current year's second half
      // But we need to check: if created_at is in Jul-Dec, the second half ends on Dec 31
      // If created_at is before Dec 31, we can't include it (it's not complete yet)
      // Actually, if created_at is in Jul-Dec, the second half ends on Dec 31, which may be after created_at
      // So we should show: current year's first half (Jan-Jun) and previous year's second half (Jul-Dec)
      // Interval 1: Previous year's second half (Jul-Dec)
      interval1StartMonth = 6; // July
      interval1EndMonth = 11; // December
      interval1Year = createdYear - 1;
      // Interval 2: Current year's first half (Jan-Jun)
      interval2StartMonth = 0; // January
      interval2EndMonth = 5; // June
      interval2Year = createdYear;
    }
    
    console.log('[sample_required] Calculated intervals - Interval1: ' + (interval1StartMonth + 1) + '-' + (interval1EndMonth + 1) + ' ' + interval1Year + ', Interval2: ' + (interval2StartMonth + 1) + '-' + (interval2EndMonth + 1) + ' ' + interval2Year);
    
    // Check if years are within valid range (2024-2026)
    if (interval1Year < 2024 || interval1Year > 2026 || interval2Year < 2024 || interval2Year > 2026) {
      console.warn(`[sample_required] Years outside valid range (2024-2026): interval1Year=${interval1Year}, interval2Year=${interval2Year}`);
      return null;
    }
    
    // Get first weekday of interval 1's start month and last weekday of interval 1's end month
    const interval1StartDate = getFirstWeekdayOfMonth(interval1Year, interval1StartMonth);
    const interval1EndDate = getLastWeekdayOfMonth(interval1Year, interval1EndMonth);
    
    // Get first weekday of interval 2's start month and last weekday of interval 2's end month
    const interval2StartDate = getFirstWeekdayOfMonth(interval2Year, interval2StartMonth);
    const interval2EndDate = getLastWeekdayOfMonth(interval2Year, interval2EndMonth);
    
    console.log('[sample_required] Interval1 dates:', interval1StartDate, 'to', interval1EndDate);
    console.log('[sample_required] Interval2 dates:', interval2StartDate, 'to', interval2EndDate);
    
    // Format intervals: "dd-mm-yyyy to dd-mm-yyyy, dd-mm-yyyy to dd-mm-yyyy"
    const interval1Str = `${formatDateDDMMYYYY(interval1StartDate)} to ${formatDateDDMMYYYY(interval1EndDate)}`;
    const interval2Str = `${formatDateDDMMYYYY(interval2StartDate)} to ${formatDateDDMMYYYY(interval2EndDate)}`;
    
    const result = `${interval1Str}, ${interval2Str}`;
    console.log('[sample_required] Final half yearly result:', result);
    return result;
  }
  
  // For 'monthly' frequency
  // Select any 3 months randomly from the last 12 months before created_at
  if (frequency === 'monthly' || frequency.includes('month')) {
    console.log('[sample_required] Processing monthly frequency');
    const createdYear = createdDate.getFullYear();
    const createdMonth = createdDate.getMonth(); // 0-11
    
    console.log('[sample_required] Created date - Year:', createdYear, 'Month:', createdMonth + 1);
    
    // Generate list of months from 12 months before created_at to 1 month before created_at
    // If created_at is Feb 2026, the months are: Feb 2025, Mar 2025, ..., Jan 2026 (12 months total)
    const availableMonths = [];
    // Start from 12 months back (i=1) to 1 month back (i=12)
    for (let i = 1; i <= 12; i++) {
      const monthDate = new Date(createdYear, createdMonth - i, 1);
      availableMonths.push({
        year: monthDate.getFullYear(),
        month: monthDate.getMonth() // 0-11
      });
    }
    
    console.log('[sample_required] Available months (last 12):', availableMonths.map(m => `${m.year}-${String(m.month + 1).padStart(2, '0')}`));
    
    // Randomly select 3 months
    const selectedMonths = [];
    const shuffledMonths = [...availableMonths].sort(() => Math.random() - 0.5); // Shuffle array
    for (let i = 0; i < 3 && i < shuffledMonths.length; i++) {
      selectedMonths.push(shuffledMonths[i]);
    }
    
    // Sort selected months chronologically (oldest first)
    selectedMonths.sort((a, b) => {
      if (a.year !== b.year) {
        return a.year - b.year;
      }
      return a.month - b.month;
    });
    
    console.log('[sample_required] Selected 3 random months:', selectedMonths.map(m => `${m.year}-${String(m.month + 1).padStart(2, '0')}`));
    
    // Check if years are within valid range (2024-2026)
    const allYears = selectedMonths.map(m => m.year);
    if (Math.min(...allYears) < 2024 || Math.max(...allYears) > 2026) {
      console.warn(`[sample_required] Years outside valid range (2024-2026):`, allYears);
      return null;
    }
    
    // Format each month interval: first weekday to last weekday
    const intervals = selectedMonths.map((monthInfo) => {
      const startDate = getFirstWeekdayOfMonth(monthInfo.year, monthInfo.month);
      const endDate = getLastWeekdayOfMonth(monthInfo.year, monthInfo.month);
      return `${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)}`;
    });
    
    const result = intervals.join(', ');
    console.log('[sample_required] Final monthly result:', result);
    return result;
  }
  
  // For 'weekly' frequency
  // Select 8 random weeks from last 12 months duration (excluding current month)
  // Each week is Monday to Friday (weekdays only)
  if (frequency === 'weekly' || frequency.includes('week')) {
    console.log('[sample_required] Processing weekly frequency');
    const createdYear = createdDate.getFullYear();
    const createdMonth = createdDate.getMonth(); // 0-11
    
    console.log('[sample_required] Created date - Year:', createdYear, 'Month:', createdMonth + 1);
    
    // Calculate date range: 12 months back from created_at, excluding current month
    // If created_at is Feb 2026, we want: Feb 2025 to Jan 2026 (excluding Feb 2026)
    const endDate = new Date(createdYear, createdMonth, 0); // Last day of previous month
    const startDate = new Date(createdYear, createdMonth - 12, 1); // First day of month 12 months back
    
    console.log('[sample_required] Date range - Start:', startDate, 'End:', endDate);
    
    // Generate all weeks (Monday to Friday) in the date range
    const allWeeks = [];
    const currentWeekStart = new Date(startDate);
    
    // Find the first Monday on or after startDate
    while (currentWeekStart.getDay() !== 1) { // 1 = Monday
      currentWeekStart.setDate(currentWeekStart.getDate() + 1);
    }
    
    // Generate weeks until we exceed endDate
    while (currentWeekStart <= endDate) {
      const weekStart = new Date(currentWeekStart);
      const weekEnd = new Date(currentWeekStart);
      
      // Week end is Friday (4 days after Monday)
      weekEnd.setDate(weekEnd.getDate() + 4);
      
      // Only include week if the entire week (Mon-Fri) is within the date range
      if (weekEnd <= endDate) {
        allWeeks.push({
          start: new Date(weekStart),
          end: new Date(weekEnd)
        });
      }
      
      // Move to next Monday (7 days forward)
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }
    
    console.log('[sample_required] Total weeks found:', allWeeks.length);
    
    // Check if we have enough weeks
    if (allWeeks.length < 8) {
      console.warn(`[sample_required] Not enough weeks found (${allWeeks.length} < 8)`);
      return null;
    }
    
    // Randomly select 8 weeks
    const shuffledWeeks = [...allWeeks].sort(() => Math.random() - 0.5);
    const selectedWeeks = shuffledWeeks.slice(0, 8);
    
    // Sort selected weeks chronologically (oldest first)
    selectedWeeks.sort((a, b) => a.start - b.start);
    
    console.log('[sample_required] Selected 8 random weeks:', selectedWeeks.map(w => 
      `${formatDateDDMMYYYY(w.start)} to ${formatDateDDMMYYYY(w.end)}`
    ));
    
    // Check if years are within valid range (2024-2026)
    const allYears = new Set();
    selectedWeeks.forEach(week => {
      allYears.add(week.start.getFullYear());
      allYears.add(week.end.getFullYear());
    });
    const minYear = Math.min(...Array.from(allYears));
    const maxYear = Math.max(...Array.from(allYears));
    
    if (minYear < 2024 || maxYear > 2026) {
      console.warn(`[sample_required] Years outside valid range (2024-2026): min=${minYear}, max=${maxYear}`);
      return null;
    }
    
    // Format each week interval: "dd-mm-yyyy to dd-mm-yyyy"
    const intervals = selectedWeeks.map(week => {
      return `${formatDateDDMMYYYY(week.start)} to ${formatDateDDMMYYYY(week.end)}`;
    });
    
    const result = intervals.join(', ');
    console.log('[sample_required] Final weekly result:', result);
    return result;
  }
  
  // For 'as & when needed' frequency (handle both "&" and "and" variations)
  // Pick 5 random dates (weekdays only) from last 6 months
  if (normalizedFreq === 'as and when needed' || normalizedFreq === 'as and when required' ||
      (normalizedFreq.includes('as') && normalizedFreq.includes('when') && (normalizedFreq.includes('needed') || normalizedFreq.includes('required')))) {
    console.log('[sample_required] Processing as & when needed frequency');
    
    // Calculate date range: 6 months back from created_at
    const endDate = new Date(createdDate);
    endDate.setDate(endDate.getDate() - 1); // Exclude created_at date itself
    const startDate = new Date(createdDate);
    startDate.setMonth(startDate.getMonth() - 6);
    
    console.log('[sample_required] Date range - Start:', startDate, 'End:', endDate);
    
    // Get all weekdays in the range
    const weekdays = getWeekdaysInRange(startDate, endDate);
    
    console.log('[sample_required] Total weekdays found:', weekdays.length);
    
    // Check if we have enough weekdays
    if (weekdays.length < 5) {
      console.warn(`[sample_required] Not enough weekdays found (${weekdays.length} < 5)`);
      return null;
    }
    
    // Randomly select 5 dates
    const shuffledDates = [...weekdays].sort(() => Math.random() - 0.5);
    const selectedDates = shuffledDates.slice(0, 5);
    
    // Sort selected dates chronologically (oldest first)
    selectedDates.sort((a, b) => a - b);
    
    console.log('[sample_required] Selected 5 random dates:', selectedDates.map(d => formatDateDDMMYYYY(d)));
    
    // Check if years are within valid range (2024-2026)
    const allYears = selectedDates.map(d => d.getFullYear());
    if (Math.min(...allYears) < 2024 || Math.max(...allYears) > 2026) {
      console.warn(`[sample_required] Years outside valid range (2024-2026):`, allYears);
      return null;
    }
    
    // Format dates: "dd-mm-yyyy, dd-mm-yyyy, ..."
    const result = selectedDates.map(d => formatDateDDMMYYYY(d)).join(', ');
    console.log('[sample_required] Final as & when needed result:', result);
    return result;
  }
  
  // For 'Recurring & Periodic' or 'daily' frequency (handle both "&" and "and" variations)
  // Pick 40 random dates (weekdays only) from last 12 months
  // Use normalizedFreq which already has "&" replaced with "and"
  if (normalizedFreq === 'recurring and periodic' || normalizedFreq === 'recurring and daily' ||
      normalizedFreq === 'daily' || 
      (normalizedFreq.includes('recurring') && (normalizedFreq.includes('periodic') || normalizedFreq.includes('daily')))) {
    console.log('[sample_required] Processing recurring & periodic/daily frequency');
    
    // Calculate date range: 12 months back from created_at
    const endDate = new Date(createdDate);
    endDate.setDate(endDate.getDate() - 1); // Exclude created_at date itself
    const startDate = new Date(createdDate);
    startDate.setMonth(startDate.getMonth() - 12);
    
    console.log('[sample_required] Date range - Start:', startDate, 'End:', endDate);
    
    // Get all weekdays in the range
    const weekdays = getWeekdaysInRange(startDate, endDate);
    
    console.log('[sample_required] Total weekdays found:', weekdays.length);
    
    // Check if we have enough weekdays
    if (weekdays.length < 40) {
      console.warn(`[sample_required] Not enough weekdays found (${weekdays.length} < 40)`);
      return null;
    }
    
    // Randomly select 40 dates
    const shuffledDates = [...weekdays].sort(() => Math.random() - 0.5);
    const selectedDates = shuffledDates.slice(0, 40);
    
    // Sort selected dates chronologically (oldest first)
    selectedDates.sort((a, b) => a - b);
    
    console.log('[sample_required] Selected 40 random dates (first 5):', selectedDates.slice(0, 5).map(d => formatDateDDMMYYYY(d)));
    
    // Check if years are within valid range (2024-2026)
    const allYears = selectedDates.map(d => d.getFullYear());
    if (Math.min(...allYears) < 2024 || Math.max(...allYears) > 2026) {
      console.warn(`[sample_required] Years outside valid range (2024-2026):`, allYears);
      return null;
    }
    
    // Format dates: "dd-mm-yyyy, dd-mm-yyyy, ..."
    const result = selectedDates.map(d => formatDateDDMMYYYY(d)).join(', ');
    console.log('[sample_required] Final recurring & periodic/daily result (first 100 chars):', result.substring(0, 100) + '...');
    return result;
  }
  
  // For 'fortnightly' frequency
  // Display 4 intervals of 14 days from last 12 months
  // Each interval must start from Monday and include weekends (14 days total)
  if (normalizedFreq === 'fortnightly' || normalizedFreq.includes('fortnight')) {
    console.log('[sample_required] Processing fortnightly frequency');
    
    // Calculate date range: 12 months back from created_at (excluding current month)
    // If created_at is Feb 22, 2026, range is: Feb 1, 2025 to Jan 31, 2026
    const endDate = new Date(createdDate.getFullYear(), createdDate.getMonth(), 0); // Last day of previous month
    const startDate = new Date(createdDate);
    startDate.setMonth(startDate.getMonth() - 12);
    startDate.setDate(1); // First day of month 12 months back
    
    console.log('[sample_required] Date range - Start:', startDate, 'End:', endDate);
    
    // Find all Mondays in the date range
    const allMondays = [];
    const currentDate = new Date(startDate);
    
    // Find the first Monday on or after startDate
    while (currentDate.getDay() !== 1) { // 1 = Monday
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Generate all Mondays until we exceed endDate
    while (currentDate <= endDate) {
      // Check if the 14-day interval starting from this Monday fits within the date range
      const intervalEnd = new Date(currentDate);
      intervalEnd.setDate(intervalEnd.getDate() + 13); // 14 days total (including start day)
      
      // Only include if the entire 14-day interval is within the date range
      if (intervalEnd <= endDate) {
        allMondays.push({
          start: new Date(currentDate),
          end: new Date(intervalEnd)
        });
      }
      
      // Move to next Monday (7 days forward)
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    console.log('[sample_required] Total fortnightly intervals found:', allMondays.length);
    
    // Check if we have enough intervals
    if (allMondays.length < 4) {
      console.warn(`[sample_required] Not enough fortnightly intervals found (${allMondays.length} < 4)`);
      return null;
    }
    
    // Randomly select 4 intervals
    const shuffledIntervals = [...allMondays].sort(() => Math.random() - 0.5);
    const selectedIntervals = shuffledIntervals.slice(0, 4);
    
    // Sort selected intervals chronologically (oldest first)
    selectedIntervals.sort((a, b) => a.start - b.start);
    
    console.log('[sample_required] Selected 4 random fortnightly intervals:', selectedIntervals.map(i => 
      `${formatDateDDMMYYYY(i.start)} to ${formatDateDDMMYYYY(i.end)}`
    ));
    
    // Check if years are within valid range (2024-2026)
    const allYears = new Set();
    selectedIntervals.forEach(interval => {
      allYears.add(interval.start.getFullYear());
      allYears.add(interval.end.getFullYear());
    });
    const minYear = Math.min(...Array.from(allYears));
    const maxYear = Math.max(...Array.from(allYears));
    
    if (minYear < 2024 || maxYear > 2026) {
      console.warn(`[sample_required] Years outside valid range (2024-2026): min=${minYear}, max=${maxYear}`);
      return null;
    }
    
    // Format each interval: "dd-mm-yyyy to dd-mm-yyyy"
    const intervals = selectedIntervals.map(interval => {
      return `${formatDateDDMMYYYY(interval.start)} to ${formatDateDDMMYYYY(interval.end)}`;
    });
    
    const result = intervals.join(', ');
    console.log('[sample_required] Final fortnightly result:', result);
    return result;
  }
  
  // For other frequencies, return null for now
  return null;
}

module.exports = {
  generateWeekdayDates,
  isWeekday,
  getWeekdaysInRange,
  formatDate,
  calculateSampleRequired,
  getSampleSizeByFrequency
};
