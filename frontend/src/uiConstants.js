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

