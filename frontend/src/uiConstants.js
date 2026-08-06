// Shared UI measurements for consistent layout across the app

// Maximum width for main content containers (e.g. dashboards, detail pages)
export const MAIN_CONTENT_MAX_WIDTH = 2100

// Maximum width for form detail page (wider content area)
export const FORM_DETAIL_MAX_WIDTH = 2100

// Root wrapper for form detail pages (aligns with dashboard content width)
export const FORM_DETAIL_ROOT_SX = {
  width: '100%',
  maxWidth: FORM_DETAIL_MAX_WIDTH,
  mx: 'auto',
  px: 0,
  py: 0,
}

// Top action row on form detail pages (e.g. change request, edit controls)
export const FORM_DETAIL_ACTION_BAR_SX = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: 1.5,
  flexWrap: 'wrap',
  width: '100%',
  minWidth: 0,
}

// Main vertical stack for form detail sections
export const FORM_DETAIL_CONTENT_STACK_SX = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  width: '100%',
  minWidth: 0,
}

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

// Table container — columns use percentage widths so dashboards stay within the viewport
export const DASHBOARD_TABLE_WRAP_SX = {
  width: '100%',
  minWidth: 0,
  overflowX: 'hidden',
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
// Management list pages (standard: company_admin/user-management)
// Transparent shell + divider header + bordered content below
// ---------------------------------------------------------------------------

export const MANAGEMENT_PAGE_SHELL_SX = {
  ...DASHBOARD_PAPER_SX,
  overflow: 'visible',
  backgroundColor: 'transparent',
  boxShadow: 'none',
  borderRadius: 0,
}

export const MANAGEMENT_PAGE_HEADER_SX = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 2,
  flexWrap: 'wrap',
  alignItems: { xs: 'stretch', md: 'flex-start' },
  py: 2.25,
  flexDirection: { xs: 'column', md: 'row' },
  borderBottom: '1px solid',
  borderColor: 'divider',
  mb: 2,
}

export const MANAGEMENT_PAGE_TITLE_SX = {
  fontSize: { xs: '1.45rem', sm: '1.7rem' },
  fontWeight: 850,
  lineHeight: 1.15,
  color: 'text.primary',
}

export const MANAGEMENT_PAGE_SUBTITLE_SX = {
  mt: 0.65,
  color: 'text.secondary',
  lineHeight: 1.6,
}

export const MANAGEMENT_PAGE_ACTIONS_SX = {
  display: 'flex',
  gap: 1.25,
  flexWrap: 'wrap',
  alignItems: 'center',
}

export function getManagementTableBorderColor(theme) {
  const isLight = theme.palette.mode === 'light'
  const base = theme.palette.text.primary
  // Match company_admin/user-management table borders
  if (typeof base === 'string' && base.startsWith('#')) {
    const alpha = isLight ? 0.16 : 0.2
    const r = parseInt(base.slice(1, 3), 16)
    const g = parseInt(base.slice(3, 5), 16)
    const b = parseInt(base.slice(5, 7), 16)
    if (!Number.isNaN(r + g + b)) return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return isLight ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.2)'
}

export function getManagementTableContainerSx(theme) {
  const borderColor = getManagementTableBorderColor(theme)
  const isDark = theme.palette.mode === 'dark'
  return {
    border: `1px solid ${borderColor}`,
    borderRadius: 1.5,
    overflow: 'hidden',
    backgroundColor: isDark
      ? 'rgba(15, 23, 42, 0.96)'
      : 'rgba(255, 255, 255, 0.92)',
  }
}

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

/** Conclusion badges — longer labels (e.g. Accepted Under Deviation) wrap inside the pill */
export const CONCLUSION_BADGE_PILL_SX = {
  ...STATUS_BADGE_PILL_SX,
  display: 'inline-block',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
  lineHeight: 1.35,
  px: 1.25,
  py: 0.625,
  width: 'auto',
  minWidth: 'min-content',
}

/** Conclusion badges in dashboard table cells — single line with ellipsis; pair with Tooltip */
export const CONCLUSION_BADGE_TABLE_PILL_SX = {
  ...STATUS_BADGE_PILL_SX,
  display: 'block',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
}

export const CONCLUSION_TABLE_CELL_SX = {
  overflow: 'hidden',
  verticalAlign: 'middle',
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
  if (s === 'Approved' || s.toLowerCase() === 'approved') return STATUS_BADGE_SOLID.success
  if (s === 'Rejected' || s.toLowerCase() === 'rejected') return STATUS_BADGE_SOLID.error
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'pending') {
    return STATUS_BADGE_SOLID.warning
  }
  if (s.toLowerCase() === 'sent for approval') {
    return STATUS_BADGE_SOLID.moderate
  }
  return STATUS_BADGE_SOLID.neutral
}

/**
 * Canonical RACM approval status label for dashboards/tables.
 * Keeps "Sent for Approval" distinct from empty/pending work.
 */
export function formatRacmApprovalStatusLabel(status) {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (!normalized || normalized === 'null') return 'Pending'
  if (normalized === 'sent for approval') return 'Sent for Approval'
  if (normalized === 'approved') return 'Approved'
  if (normalized === 'rejected') return 'Rejected'
  if (normalized === 'pending') return 'Pending'
  return String(status).trim().charAt(0).toUpperCase() + String(status).trim().slice(1)
}

/** Convert a UI filter label/value into the API status query param. */
export function toRacmApprovalStatusQueryParam(filterValue) {
  const normalized = String(filterValue ?? '').trim().toLowerCase()
  if (!normalized || normalized === 'all') return null
  if (normalized === 'pending') return 'pending'
  if (normalized === 'sent for approval') return 'sent for approval'
  if (normalized === 'approved') return 'approved'
  if (normalized === 'rejected') return 'rejected'
  return normalized
}

/** UI labels such as Pending / Sent for Approval / Approved / Rejected (e.g. after formatRacmApprovalStatusLabel) */
export function getApprovalStatusBadgeSolidColors(label) {
  if (label === 'Approved') return STATUS_BADGE_SOLID.success
  if (label === 'Rejected') return STATUS_BADGE_SOLID.error
  if (label === 'Sent for Approval') return STATUS_BADGE_SOLID.moderate
  return STATUS_BADGE_SOLID.warning
}

/** Pill layout for approval labels — wrap long text the same way as conclusion badges. */
export function getApprovalStatusBadgePillSx(label) {
  const normalized = String(label || '').trim().toLowerCase()
  // "Sent for approval" tends to overflow in dashboard table layouts.
  // Use the same table-cell ellipsis styling as "Accepted Under Deviation".
  if (normalized === 'sent for approval') return CONCLUSION_BADGE_TABLE_PILL_SX
  if (normalized.length > 12) return CONCLUSION_BADGE_PILL_SX
  return STATUS_BADGE_PILL_SX
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

/** True when a click originated from the MUI Alert dismiss (X) action area. */
export function isMuiAlertCloseActionClick(event) {
  return Boolean(event?.target?.closest?.('.MuiAlert-action'))
}

