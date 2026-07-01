
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

const SUPPORTED_CONTROL_FREQUENCY_CATEGORIES = [
  { key: 'yearly', value: 'Yearly', sampleSize: 1, maxSampleSize: 3 },
  { key: 'half_yearly', value: 'Half Yearly', sampleSize: 2, maxSampleSize: 6 },
  { key: 'quarterly', value: 'Quarterly', sampleSize: 2, maxSampleSize: 12 },
  { key: 'monthly', value: 'Monthly', sampleSize: 3, maxSampleSize: 24 },
  { key: 'weekly', value: 'Weekly', sampleSize: 8, maxSampleSize: 53 },
  { key: 'fortnightly', value: 'Fortnightly', sampleSize: 4, maxSampleSize: 26 },
  { key: 'as_when_needed', value: 'As & When Needed', sampleSize: 5, maxSampleSize: 50 },
  { key: 'daily', value: 'Daily', sampleSize: 25, maxSampleSize: 100 },
  { key: 'recurring', value: 'Recurring & Periodic', sampleSize: 40, maxSampleSize: 120 },
];

function hasFrequencyWords(normalizedFreq, ...words) {
  return words.every((word) => normalizedFreq.includes(word));
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
    normalizedFreq === 'ongoing' ||
    hasFrequencyWords(normalizedFreq, 'on', 'going')
  ) {
    return byKey('as_when_needed');
  }

  if (normalizedFreq === 'daily') {
    return byKey('daily');
  }

  if (
    normalizedFreq === 'recurring and periodic' ||
    normalizedFreq === 'recurring' ||
    (normalizedFreq.includes('recurring') && normalizedFreq.includes('periodic'))
  ) {
    return byKey('recurring');
  }

  return null;
}

function getSampleSizeByFrequency(controlFrequency) {
  const category = resolveControlFrequencyCategory(controlFrequency);
  return category ? category.sampleSize : null;
}

function getMaximumSampleSizeByFrequency(controlFrequency) {
  const category = resolveControlFrequencyCategory(controlFrequency);
  return category?.maxSampleSize ?? null;
}

function getSupportedControlFrequencyCategories() {
  return SUPPORTED_CONTROL_FREQUENCY_CATEGORIES.map(({ value, sampleSize, maxSampleSize }) => ({
    value,
    sampleSize,
    maxSampleSize: maxSampleSize ?? null,
  }));
}

function isSupportedControlFrequency(controlFrequency) {
  return resolveControlFrequencyCategory(controlFrequency) !== null;
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

function getThreeYearsAgoDate(fromDate) {
  const minDate = new Date(fromDate);
  minDate.setFullYear(minDate.getFullYear() - 3);
  return minDate;
}

function isOnOrAfter(date, minDate) {
  return date.getTime() >= minDate.getTime();
}

function getSequentialWeekdaySampleDates(endDate, sampleSize, minDate) {
  const selected = [];
  const cursor = new Date(endDate);

  while (selected.length < sampleSize) {
    if (!isOnOrAfter(cursor, minDate)) {
      break;
    }
    if (isWeekday(cursor)) {
      selected.unshift(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  if (selected.length < sampleSize) {
    console.warn(`[sample_required] Not enough weekdays within 3 years (${selected.length} < ${sampleSize})`);
    return null;
  }

  return selected;
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

  const threeYearsAgo = getThreeYearsAgoDate(createdDate);

  switch (category.key) {
    case 'yearly': {
      const createdYear = createdDate.getFullYear();
      const years = [];
      for (let i = sampleSize; i >= 1; i -= 1) {
        years.push(String(createdYear - i));
      }
      return years.join(', ');
    }

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

      const intervals = selectedQuarters
        .map(({ year, quarter }) => {
          const quarterInfo = getQuarterInfoByQuarter(quarter);
          const startDate = getFirstWeekdayOfMonth(year, quarterInfo.startMonth);
          const endDate = getLastWeekdayOfMonth(year, quarterInfo.endMonth);
          return { startDate, endDate };
        })
        .filter(({ startDate }) => isOnOrAfter(startDate, threeYearsAgo))
        .map(({ startDate, endDate }) => `${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)}`);

      if (intervals.length < sampleSize) {
        console.warn('[sample_required] Not enough quarterly intervals within 3 years');
        return null;
      }

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

      const intervals = selectedHalves
        .map(({ year: halfYear, startMonth, endMonth }) => {
          const startDate = getFirstWeekdayOfMonth(halfYear, startMonth);
          const endDate = getLastWeekdayOfMonth(halfYear, endMonth);
          return { startDate, endDate };
        })
        .filter(({ startDate }) => isOnOrAfter(startDate, threeYearsAgo))
        .map(({ startDate, endDate }) => `${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)}`);

      if (intervals.length < sampleSize) {
        console.warn('[sample_required] Not enough half-yearly intervals within 3 years');
        return null;
      }

      const result = intervals.join(', ');
      console.log('[sample_required] Final half yearly result:', result);
      return result;
    }

    case 'monthly': {
      console.log('[sample_required] Processing monthly frequency');
      const createdYear = createdDate.getFullYear();
      const createdMonth = createdDate.getMonth();
      const selectedMonths = [];

      for (let i = 1; i <= sampleSize; i += 1) {
        const monthDate = new Date(createdYear, createdMonth - i, 1);
        selectedMonths.push({
          year: monthDate.getFullYear(),
          month: monthDate.getMonth(),
        });
      }

      selectedMonths.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      const intervals = selectedMonths
        .map((monthInfo) => {
          const startDate = getFirstWeekdayOfMonth(monthInfo.year, monthInfo.month);
          const endDate = getLastWeekdayOfMonth(monthInfo.year, monthInfo.month);
          return { startDate, endDate };
        })
        .filter(({ startDate }) => isOnOrAfter(startDate, threeYearsAgo))
        .map(({ startDate, endDate }) => `${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)}`);

      if (intervals.length < sampleSize) {
        console.warn('[sample_required] Not enough monthly intervals within 3 years');
        return null;
      }

      const result = intervals.join(', ');
      console.log('[sample_required] Final monthly result:', result);
      return result;
    }

    case 'weekly': {
      console.log('[sample_required] Processing weekly frequency');
      const endDate = new Date(createdDate);
      endDate.setDate(endDate.getDate() - 1);
      let weekStart = new Date(endDate);
      while (weekStart.getDay() !== 1) {
        weekStart.setDate(weekStart.getDate() - 1);
      }
      weekStart.setDate(weekStart.getDate() - 7);

      const selectedWeeks = [];
      for (let i = 0; i < sampleSize; i += 1) {
        if (!isOnOrAfter(weekStart, threeYearsAgo)) {
          break;
        }
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 4);
        selectedWeeks.unshift({
          start: new Date(weekStart),
          end: new Date(weekEnd),
        });
        weekStart.setDate(weekStart.getDate() - 7);
      }

      if (selectedWeeks.length < sampleSize) {
        console.warn('[sample_required] Not enough weekly intervals within 3 years');
        return null;
      }

      const intervals = selectedWeeks.map((week) => `${formatDateDDMMYYYY(week.start)} to ${formatDateDDMMYYYY(week.end)}`);
      const result = intervals.join(', ');
      console.log('[sample_required] Final weekly result:', result);
      return result;
    }

    case 'as_when_needed': {
      console.log('[sample_required] Processing as & when needed frequency');
      const endDate = new Date(createdDate);
      endDate.setDate(endDate.getDate() - 1);

      const selectedDates = getSequentialWeekdaySampleDates(endDate, sampleSize, threeYearsAgo);
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

      const selectedDates = getSequentialWeekdaySampleDates(endDate, sampleSize, threeYearsAgo);
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

      const selectedDates = getSequentialWeekdaySampleDates(endDate, sampleSize, threeYearsAgo);
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
      let intervalStart = new Date(endDate);
      while (intervalStart.getDay() !== 1) {
        intervalStart.setDate(intervalStart.getDate() - 1);
      }
      intervalStart.setDate(intervalStart.getDate() - 14);

      const selectedIntervals = [];
      for (let i = 0; i < sampleSize; i += 1) {
        if (!isOnOrAfter(intervalStart, threeYearsAgo)) {
          break;
        }
        const intervalEnd = new Date(intervalStart);
        intervalEnd.setDate(intervalEnd.getDate() + 13);
        selectedIntervals.unshift({
          start: new Date(intervalStart),
          end: new Date(intervalEnd),
        });
        intervalStart.setDate(intervalStart.getDate() - 14);
      }

      if (selectedIntervals.length < sampleSize) {
        console.warn('[sample_required] Not enough fortnightly intervals within 3 years');
        return null;
      }

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
  getMaximumSampleSizeByFrequency,
  SUPPORTED_CONTROL_FREQUENCY_CATEGORIES,
};
