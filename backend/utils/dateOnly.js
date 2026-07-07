function parseDateInput(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0));
  }

  const dbTsMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/
  );
  if (dbTsMatch) {
    const [, y, m, d, hh, mm, ss, micros = ''] = dbTsMatch;
    const millis = Number((micros + '000').slice(0, 3));
    return new Date(Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
      millis
    ));
  }

  const normalized = /[zZ]$|[+-]\d{2}:\d{2}$/.test(raw)
    ? raw
    : raw.replace(' ', 'T') + 'Z';

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDateOnlyValue(value) {
  if (value == null) return '';

  const raw = String(value).trim();
  if (!raw) return '';

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
  }

  const date = parseDateInput(value);
  if (!date) {
    const prefixMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return prefixMatch ? `${prefixMatch[1]}-${prefixMatch[2]}-${prefixMatch[3]}` : '';
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

module.exports = {
  normalizeDateOnlyValue,
  parseDateInput,
};
