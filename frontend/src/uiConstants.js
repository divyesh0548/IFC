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

// Autocomplete inside MUI Dialog needs a higher popper z-index than the modal surface.
export const DIALOG_AUTOCOMPLETE_SLOT_PROPS = {
  popper: {
    sx: { zIndex: (theme) => theme.zIndex.modal + 1 },
  },
}

// Vertical gap between navbar, back-to-home, and page content in DashboardLayout
export const DASHBOARD_SECTION_GAP = 3

// Standard outer wrapper for dashboard list pages (top spacing comes from DashboardLayout)
export const DASHBOARD_PAGE_OUTER_SX = {
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  mx: 'auto',
  px: 0,
  pb: 4,
  boxSizing: 'border-box',
}

// Full-width dashboard content surfaces (Paper, table shells, etc.)
export const DASHBOARD_PAPER_SX = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
}

// Horizontal scroll container for wide dashboard tables
export const DASHBOARD_TABLE_WRAP_SX = {
  width: '100%',
  minWidth: 0,
  overflowX: 'auto',
}
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
  lineHeight: 1.25,
  textAlign: 'center',
  whiteSpace: 'nowrap',
  wordBreak: 'normal',
  overflowWrap: 'normal',
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
  moderate: { backgroundColor: '#e0f2fe', color: '#075985' },
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

export function getConclusionBadgeSolidColors(value) {
  const normalized = String(value || '').trim().toLowerCase()

  if (normalized === 'effective') return STATUS_BADGE_SOLID.success
  if (normalized === 'not effective') return STATUS_BADGE_SOLID.warning
  if (normalized === 'accepted under deviation') return STATUS_BADGE_SOLID.moderate

  return STATUS_BADGE_SOLID.neutral
}

