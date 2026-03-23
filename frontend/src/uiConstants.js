// Shared UI measurements for consistent layout across the app

// Maximum width for main content containers (e.g. dashboards, detail pages)
export const MAIN_CONTENT_MAX_WIDTH = 1200

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

