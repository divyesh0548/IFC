// Shared UI measurements for consistent layout across the app

// Maximum width for main content containers (e.g. dashboards, detail pages)
export const MAIN_CONTENT_MAX_WIDTH = 2100

// Maximum width for form detail page (wider content area)
export const FORM_DETAIL_MAX_WIDTH = 2100

// Default min-width for compact dropdown filters (e.g. Status, Year)
export const FILTER_DROPDOWN_MIN_WIDTH_SM = 180

// Default min-width for slightly wider dropdowns (e.g. Business Process names)
export const FILTER_DROPDOWN_MIN_WIDTH_LG = 220

// Standard width for full-width filters when used inside responsive containers
export const FILTER_BOX_MIN_WIDTH = {
  xs: '100%',
  sm: FILTER_DROPDOWN_MIN_WIDTH_SM,
}

// Shared typography style for the small explanatory line under page headers.
// Example: “Analyze and monitor RACM for your company.”
export const PAGE_SUBHEADER_TEXT_SX = {
  color: 'text.secondary',
  fontSize: '0.95rem',
  lineHeight: 1.6,
  fontWeight: 500,
}

// Shared table surface colors to avoid page-level hardcoded mode values.
// Keeps row and container visuals consistent in both light/dark themes.
export const TABLE_HEADER_BG = 'action.hover'
export const TABLE_ROW_HOVER_BG = 'action.hover'

// ---------------------------------------------------------------------------
// Status badges (solid pastels — same in light and dark mode site-wide)
// ---------------------------------------------------------------------------

/** Base pill used in data tables */
export const STATUS_BADGE_PILL_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  px: 1,
  py: 0.5,
  fontSize: '0.75rem',
  fontWeight: 600,
  borderRadius: '9999px',
  width: 'fit-content',
  maxWidth: '100%',
  boxSizing: 'border-box',
}

/** Same colors, slightly larger type for form summary cards */
export const STATUS_BADGE_DETAIL_SX = {
  ...STATUS_BADGE_PILL_SX,
  fontSize: '0.875rem',
}

const STATUS_BADGE_SOLID = {
  success: { backgroundColor: '#d1fae5', color: '#065f46' },
  error: { backgroundColor: '#fee2e2', color: '#991b1b' },
  warning: { backgroundColor: '#fef3c7', color: '#92400e' },
  neutral: { backgroundColor: '#f3f4f6', color: '#6b7280' },
}

/** Raw API/DB `status` on control_forms */
export function getStatusBadgeSolidColors(status) {
  const s = String(status ?? '').trim()
  if (s === 'Approved') return STATUS_BADGE_SOLID.success
  if (s === 'Rejected') return STATUS_BADGE_SOLID.error
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'sent for approval') {
    return STATUS_BADGE_SOLID.warning
  }
  return STATUS_BADGE_SOLID.neutral
}

/** UI labels such as Pending / Approved / Rejected (e.g. after formatStatus) */
export function getApprovalStatusBadgeSolidColors(label) {
  if (label === 'Approved') return STATUS_BADGE_SOLID.success
  if (label === 'Rejected') return STATUS_BADGE_SOLID.error
  return STATUS_BADGE_SOLID.warning
}

export function getActivityBadgeSolidColors(isActive) {
  return isActive ? STATUS_BADGE_SOLID.success : STATUS_BADGE_SOLID.error
}

