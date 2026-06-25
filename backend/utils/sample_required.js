
/**
 * Generate weekday dates for the current year up to the supplied as-of date.
 * @param {Date|string} asOfDate - Date that caps generated dates; defaults to now.
 * @returns {Date[]} Array of Date objects (weekdays only)
 */
function generateWeekdayDates(asOfDate = new Date()) {
  const dates = [];
  const end = asOfDate instanceof Date ? new Date(asOfDate) : new Date(asOfDate);
  if (isNaN(end.getTime())) return dates;

  const startDate = new Date(end.getFullYear(), 0, 1);

  for (let date = new Date(startDate); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    // Exclude weekends: 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(new Date(date));
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

function normalizeControlFrequencyValue(controlFrequency) {
  if (!controlFrequency) {
    return '';
  }

  const normalized = String(controlFrequency)
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized === 'annual' || normalized === 'annually') {
    return 'yearly';
  }

  return normalized;
}

const SUPPORTED_CONTROL_FREQUENCY_CATEGORIES = [
  { key: 'yearly', value: 'Yearly', sampleSize: 1 },
  { key: 'half_yearly', value: 'Half Yearly', sampleSize: 2 },
  { key: 'quarterly', value: 'Quarterly', sampleSize: 2 },
  { key: 'monthly', value: 'Monthly', sampleSize: 3 },
  { key: 'weekly', value: 'Weekly', sampleSize: 8 },
  { key: 'fortnightly', value: 'Fortnightly', sampleSize: 4 },
  { key: 'as_when_needed', value: 'As & When Needed', sampleSize: 5 },
  { key: 'daily', value: 'Daily', sampleSize: 25 },
  { key: 'recurring', value: 'Recurring & Periodic', sampleSize: 40 },
];

function getSupportedControlFrequencyCategories() {
  return SUPPORTED_CONTROL_FREQUENCY_CATEGORIES.map(({ value, sampleSize }) => ({ value, sampleSize }));
}

function hasFrequencyWords(normalizedFreq, ...words) {
  return words.every((word) => normalizedFreq.includes(word));
}

function resolveControlFrequencyCategory(controlFrequency) {
  const normalizedFreq = normalizeControlFrequencyValue(controlFrequency);
  if (!normalizedFreq) {
    return null;
  }

  const byKey = (key) => SUPPORTED_CONTROL_FREQUENCY_CATEGORIES.find((item) => item.key === key) || null;

  if (normalizedFreq === 'yearly' || hasFrequencyWords(normalizedFreq, 'annual')) {
    return byKey('yearly');
  }

  if (normalizedFreq === 'half yearly' || hasFrequencyWords(normalizedFreq, 'half', 'year')) {
    return byKey('half_yearly');
  }

  if (normalizedFreq === 'quarterly' || normalizedFreq.includes('quarter')) {
    return byKey('quarterly');
  }

  if (normalizedFreq === 'monthly') {
    return byKey('monthly');
  }

  if (normalizedFreq === 'weekly') {
    return byKey('weekly');
  }

  if (normalizedFreq === 'fortnightly' || normalizedFreq.includes('fortnight')) {
    return byKey('fortnightly');
  }

  if (
    normalizedFreq === 'as and when' ||
    normalizedFreq === 'as and when needed' ||
    normalizedFreq === 'as and when required' ||
    hasFrequencyWords(normalizedFreq, 'as', 'when') ||
    normalizedFreq === 'on event' ||
    normalizedFreq === 'on going' ||
    normalizedFreq === 'ongoing'
  ) {
    return byKey('as_when_needed');
  }

  if (normalizedFreq === 'daily') {
    return byKey('daily');
  }

  if (
    normalizedFreq === 'recurring' ||
    normalizedFreq === 'recurring and periodic' ||
    normalizedFreq.includes('recurring') ||
    normalizedFreq.includes('periodic')
  ) {
    return byKey('recurring');
  }

  return null;
}

function getSampleSizeByFrequency(controlFrequency) {
  const category = resolveControlFrequencyCategory(controlFrequency);
  return category ? category.sampleSize : null;
}

function parseSampleSize(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function resolveSampleSize(category, sampleSizeOverride) {
  const override = parseSampleSize(sampleSizeOverride);
  if (override !== null) {
    return override;
  }

  return category?.sampleSize ?? null;
}

function getRandomWeekdaySampleDates(startDate, endDate, sampleSize) {
  const weekdays = getWeekdaysInRange(startDate, endDate);

  if (weekdays.length < sampleSize) {
    console.warn(`[sample_required] Not enough weekdays found (${weekdays.length} < ${sampleSize})`);
    return null;
  }

  const shuffledDates = [...weekdays].sort(() => Math.random() - 0.5);
  const selectedDates = shuffledDates.slice(0, sampleSize);
  selectedDates.sort((a, b) => a - b);

  return selectedDates;
}

function isSupportedControlFrequency(controlFrequency) {
  return resolveControlFrequencyCategory(controlFrequency) !== null;
}

/**
 * Calculate sample_required date based on control_frequency, created_at, and sample size.
 * @param {string} controlFrequency - The control frequency value
 * @param {Date|string} createdAt - The created_at timestamp of the control form
 * @param {number|string|null|undefined} sampleSizeOverride - Optional sample size; defaults to category minimum
 * @returns {string|null} Formatted date string or null if frequency is not supported
 */
function calculateSampleRequired(controlFrequency, createdAt, sampleSizeOverride) {
  if (!controlFrequency || !createdAt) {
    console.log('[sample_required] Missing controlFrequency or createdAt:', { controlFrequency, createdAt });
    return null;
  }

  const frequency = String(controlFrequency).toLowerCase().trim();
  const normalizedFreq = normalizeControlFrequencyValue(controlFrequency);
  const category = resolveControlFrequencyCategory(controlFrequency);
  console.log('[sample_required] Normalized frequency:', frequency, 'normalized (no &):', normalizedFreq, 'from original:', controlFrequency);

  if (!category) {
    return null;
  }

  const sampleSize = resolveSampleSize(category, sampleSizeOverride);
  if (sampleSize === null) {
    console.error('[sample_required] Invalid sample size:', sampleSizeOverride);
    return null;
  }

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

  console.log('[sample_required] Processing frequency category:', category.key, 'sampleSize:', sampleSize, 'for date:', createdDate);

  switch (category.key) {
    case 'yearly':
      return String(createdDate.getFullYear() - 1);

    case 'quarterly': {
      console.log('[sample_required] Processing quarterly frequency');
      const createdYear = createdDate.getFullYear();
      const createdMonth = createdDate.getMonth();
      const currentQuarter = getQuarterInfo(createdMonth).quarter;
      const selectedQuarters = [];

      for (let offset = 1; offset <= sampleSize; offset++) {
        const zeroBasedQuarterIndex = currentQuarter - 1 - offset;
        const quarter = ((zeroBasedQuarterIndex % 4) + 4) % 4 + 1;
        const year = createdYear + Math.floor(zeroBasedQuarterIndex / 4);
        selectedQuarters.push({ year, quarter });
      }

      selectedQuarters.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.quarter - b.quarter;
      });

      console.log('[sample_required] Selected completed quarters:', selectedQuarters);

      const intervals = selectedQuarters.map(({ year, quarter }) => {
        const quarterInfo = getQuarterInfoByQuarter(quarter);
        const startDate = getFirstWeekdayOfMonth(year, quarterInfo.startMonth);
        const endDate = getLastWeekdayOfMonth(year, quarterInfo.endMonth);
        return `${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)}`;
      });

      const result = intervals.join(', ');
      console.log('[sample_required] Final quarterly result:', result);
      return result;
    }

    case 'half_yearly': {
      console.log('[sample_required] Processing half yearly frequency');
      const createdYear = createdDate.getFullYear();
      const createdMonth = createdDate.getMonth();
      let half = createdMonth <= 5 ? 1 : 2;
      let year = createdYear;
      const selectedHalves = [];

      for (let index = 0; index < sampleSize; index += 1) {
        if (half === 1) {
          half = 2;
          year -= 1;
        } else {
          half = 1;
        }

        const startMonth = half === 1 ? 0 : 6;
        const endMonth = half === 1 ? 5 : 11;
        selectedHalves.push({ year, startMonth, endMonth });
      }

      selectedHalves.reverse();

      const intervals = selectedHalves.map(({ year: halfYear, startMonth, endMonth }) => {
        const startDate = getFirstWeekdayOfMonth(halfYear, startMonth);
        const endDate = getLastWeekdayOfMonth(halfYear, endMonth);
        return `${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)}`;
      });

      const result = intervals.join(', ');
      console.log('[sample_required] Final half yearly result:', result);
      return result;
    }

    case 'monthly': {
      console.log('[sample_required] Processing monthly frequency');
      const createdYear = createdDate.getFullYear();
      const createdMonth = createdDate.getMonth();
      const availableMonths = [];

      for (let i = 1; i <= 12; i++) {
        const monthDate = new Date(createdYear, createdMonth - i, 1);
        availableMonths.push({
          year: monthDate.getFullYear(),
          month: monthDate.getMonth()
        });
      }

      if (availableMonths.length < sampleSize) {
        console.warn(`[sample_required] Not enough months found (${availableMonths.length} < ${sampleSize})`);
        return null;
      }

      const shuffledMonths = [...availableMonths].sort(() => Math.random() - 0.5);
      const selectedMonths = shuffledMonths.slice(0, sampleSize);

      selectedMonths.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      const intervals = selectedMonths.map((monthInfo) => {
        const startDate = getFirstWeekdayOfMonth(monthInfo.year, monthInfo.month);
        const endDate = getLastWeekdayOfMonth(monthInfo.year, monthInfo.month);
        return `${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)}`;
      });

      const result = intervals.join(', ');
      console.log('[sample_required] Final monthly result:', result);
      return result;
    }

    case 'weekly': {
      console.log('[sample_required] Processing weekly frequency');
      const createdYear = createdDate.getFullYear();
      const createdMonth = createdDate.getMonth();
      const endDate = new Date(createdYear, createdMonth, 0);
      const startDate = new Date(createdYear, createdMonth - 12, 1);
      const allWeeks = [];
      const currentWeekStart = new Date(startDate);

      while (currentWeekStart.getDay() !== 1) {
        currentWeekStart.setDate(currentWeekStart.getDate() + 1);
      }

      while (currentWeekStart <= endDate) {
        const weekStart = new Date(currentWeekStart);
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 4);

        if (weekEnd <= endDate) {
          allWeeks.push({
            start: new Date(weekStart),
            end: new Date(weekEnd)
          });
        }

        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      }

      if (allWeeks.length < sampleSize) {
        console.warn(`[sample_required] Not enough weeks found (${allWeeks.length} < ${sampleSize})`);
        return null;
      }

      const shuffledWeeks = [...allWeeks].sort(() => Math.random() - 0.5);
      const selectedWeeks = shuffledWeeks.slice(0, sampleSize);
      selectedWeeks.sort((a, b) => a.start - b.start);

      const intervals = selectedWeeks.map((week) => `${formatDateDDMMYYYY(week.start)} to ${formatDateDDMMYYYY(week.end)}`);
      const result = intervals.join(', ');
      console.log('[sample_required] Final weekly result:', result);
      return result;
    }

    case 'as_when_needed': {
      console.log('[sample_required] Processing as & when needed frequency');
      const endDate = new Date(createdDate);
      endDate.setDate(endDate.getDate() - 1);
      const startDate = new Date(createdDate);
      startDate.setMonth(startDate.getMonth() - 6);

      const selectedDates = getRandomWeekdaySampleDates(startDate, endDate, sampleSize);
      if (!selectedDates) {
        return null;
      }

      const result = selectedDates.map((d) => formatDateDDMMYYYY(d)).join(', ');
      console.log('[sample_required] Final as & when needed result:', result);
      return result;
    }

    case 'daily': {
      console.log('[sample_required] Processing daily frequency');
      const endDate = new Date(createdDate);
      endDate.setDate(endDate.getDate() - 1);
      const startDate = new Date(createdDate);
      startDate.setMonth(startDate.getMonth() - 12);

      const selectedDates = getRandomWeekdaySampleDates(startDate, endDate, sampleSize);
      if (!selectedDates) {
        return null;
      }

      const result = selectedDates.map((d) => formatDateDDMMYYYY(d)).join(', ');
      console.log('[sample_required] Final daily result (first 100 chars):', result.substring(0, 100) + '...');
      return result;
    }

    case 'recurring': {
      console.log('[sample_required] Processing recurring frequency');
      const endDate = new Date(createdDate);
      endDate.setDate(endDate.getDate() - 1);
      const startDate = new Date(createdDate);
      startDate.setMonth(startDate.getMonth() - 12);

      const selectedDates = getRandomWeekdaySampleDates(startDate, endDate, sampleSize);
      if (!selectedDates) {
        return null;
      }

      const result = selectedDates.map((d) => formatDateDDMMYYYY(d)).join(', ');
      console.log('[sample_required] Final recurring result (first 100 chars):', result.substring(0, 100) + '...');
      return result;
    }

    case 'fortnightly': {
      console.log('[sample_required] Processing fortnightly frequency');
      const endDate = new Date(createdDate.getFullYear(), createdDate.getMonth(), 0);
      const startDate = new Date(createdDate);
      startDate.setMonth(startDate.getMonth() - 12);
      startDate.setDate(1);
      const allMondays = [];
      const currentDate = new Date(startDate);

      while (currentDate.getDay() !== 1) {
        currentDate.setDate(currentDate.getDate() + 1);
      }

      while (currentDate <= endDate) {
        const intervalEnd = new Date(currentDate);
        intervalEnd.setDate(intervalEnd.getDate() + 13);

        if (intervalEnd <= endDate) {
          allMondays.push({
            start: new Date(currentDate),
            end: new Date(intervalEnd)
          });
        }

        currentDate.setDate(currentDate.getDate() + 7);
      }

      if (allMondays.length < sampleSize) {
        console.warn(`[sample_required] Not enough fortnightly intervals found (${allMondays.length} < ${sampleSize})`);
        return null;
      }

      const shuffledIntervals = [...allMondays].sort(() => Math.random() - 0.5);
      const selectedIntervals = shuffledIntervals.slice(0, sampleSize);
      selectedIntervals.sort((a, b) => a.start - b.start);

      const intervals = selectedIntervals.map((interval) => `${formatDateDDMMYYYY(interval.start)} to ${formatDateDDMMYYYY(interval.end)}`);
      const result = intervals.join(', ');
      console.log('[sample_required] Final fortnightly result:', result);
      return result;
    }

    default:
      return null;
  }
}

module.exports = {
  generateWeekdayDates,
  isWeekday,
  getWeekdaysInRange,
  formatDate,
  calculateSampleRequired,
  getSampleSizeByFrequency,
  resolveSampleSize,
  parseSampleSize,
  normalizeControlFrequencyValue,
  resolveControlFrequencyCategory,
  isSupportedControlFrequency,
  getSupportedControlFrequencyCategories,
  SUPPORTED_CONTROL_FREQUENCY_CATEGORIES,
};
