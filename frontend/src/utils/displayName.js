/**
 * Format emp_name or email into a human-readable display name.
 * Splits on . - _ | (and whitespace) and title-cases each segment.
 */
export function formatDisplayName(value, fallback = 'User') {
  const raw = String(value || '').trim()
  if (!raw) return fallback

  const source = raw.includes('@') ? (raw.split('@')[0] || '') : raw
  const words = source
    .split(/[._\-|\s]+/)
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())

  return words.length > 0 ? words.join(' ') : fallback
}