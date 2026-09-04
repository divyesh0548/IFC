/**
 * Resolve dashboard breadcrumb trails from the current pathname.
 * UI-only helper — does not affect routing or page logic.
 *
 * Returns null on role home pages (no breadcrumb).
 * items: [{ label, to? }] — last item is the active (muted) crumb.
 */

function getHomePath(pathname) {
  if (pathname.startsWith('/company-co')) return '/company-co/home'
  if (pathname.startsWith('/company_admin')) return '/company_admin/home'
  if (pathname.startsWith('/siteadmin')) return '/siteadmin/dashboard'
  if (pathname.startsWith('/user')) return '/user/home'
  if (pathname.startsWith('/approver')) return '/approver/home'
  if (pathname.startsWith('/auditor')) return '/auditor/home'
  return null
}

function normalizePath(pathname) {
  const raw = String(pathname || '').split('?')[0].split('#')[0]
  if (!raw || raw === '/') return '/'
  return raw.replace(/\/+$/, '') || '/'
}

function homeItem(homePath) {
  return { label: 'Home', to: homePath }
}

/** Ordered from most specific to least specific. */
const BREADCRUMB_RULES = [
  // —— Company coordinator ——
  {
    test: (p) => p === '/company-co/user-management/create-user',
    build: (home) => [
      homeItem(home),
      { label: 'User', to: '/company-co/user-management' },
      { label: 'Create' },
    ],
  },
  {
    test: (p) => p === '/company-co/user-management',
    build: (home) => [homeItem(home), { label: 'User' }],
  },
  {
    test: (p) => p === '/company-co/control-creation/column-map',
    build: (home) => [
      homeItem(home),
      { label: 'RACM Upload', to: '/company-co/control-creation' },
      { label: 'Column Map' },
    ],
  },
  {
    test: (p) => p === '/company-co/control-creation',
    build: (home) => [homeItem(home), { label: 'RACM Upload' }],
  },
  {
    test: (p) => p === '/company-co/manual-control-creation',
    build: (home) => [
      homeItem(home),
      { label: 'RACM Upload', to: '/company-co/control-creation' },
      { label: 'Manual Create' },
    ],
  },
  {
    test: (p) => p === '/company-co/library-control-creation',
    build: (home) => [
      homeItem(home),
      { label: 'RACM Upload', to: '/company-co/control-creation' },
      { label: 'Library Create' },
    ],
  },
  {
    test: (p) => p === '/company-co/unclassified-controls',
    build: (home) => [
      homeItem(home),
      { label: 'Control Dispersion', to: '/company-co/control-dispersion-dashboard' },
      { label: 'Unclassified' },
    ],
  },
  {
    test: (p) => p === '/company-co/key-manual-ai-insights',
    build: (home) => [
      homeItem(home),
      { label: 'Control Dispersion', to: '/company-co/control-dispersion-dashboard' },
      { label: 'AI Insights' },
    ],
  },
  {
    test: (p) => p === '/company-co/control-dispersion-dashboard',
    build: (home) => [homeItem(home), { label: 'Control Dispersion' }],
  },
  {
    test: (p) => p === '/company-co/risk-analysis',
    build: (home) => [homeItem(home), { label: 'Risk Analysis' }],
  },
  {
    test: (p) => p === '/company-co/racm-management',
    build: (home) => [homeItem(home), { label: 'RACM Management' }],
  },
  {
    test: (p) => p === '/company-co/ifc-report',
    build: (home) => [homeItem(home), { label: 'IFC Report' }],
  },
  {
    test: (p) => p === '/company-co/racm-user-documents',
    build: (home) => [homeItem(home), { label: 'User Documents' }],
  },
  {
    test: (p) => p === '/company-co/racm-communication',
    build: (home) => [homeItem(home), { label: 'RACM Communication' }],
  },
  {
    test: (p) => p === '/company-co/email-customization',
    build: (home) => [homeItem(home), { label: 'Email Customization' }],
  },
  {
    test: (p) => p === '/company-co/racm-templates',
    build: (home) => [homeItem(home), { label: 'Templates' }],
  },
  {
    test: (p) => p === '/company-co/racm-assignment',
    build: (home) => [homeItem(home), { label: 'RACM Assignment' }],
  },
  {
    test: (p) => p === '/company-co/company-details',
    build: (home) => [homeItem(home), { label: 'Company Details' }],
  },
  {
    test: (p) => /^\/company-co\/form\/[^/]+$/.test(p),
    build: (home) => [
      homeItem(home),
      { label: 'RACM Management', to: '/company-co/racm-management' },
      { label: 'RACM' },
    ],
  },
  {
    test: (p) => p === '/company-co/profile',
    build: (home) => [homeItem(home), { label: 'Profile' }],
  },

  // —— Company admin ——
  {
    test: (p) => p === '/company_admin/create-user',
    build: (home) => [
      homeItem(home),
      { label: 'User', to: '/company_admin/user-management' },
      { label: 'Create' },
    ],
  },
  {
    test: (p) => p === '/company_admin/user-management',
    build: (home) => [homeItem(home), { label: 'User' }],
  },
  {
    test: (p) => p === '/company_admin/unit-management',
    build: (home) => [homeItem(home), { label: 'Units' }],
  },
  {
    test: (p) => p === '/company_admin/approver-management',
    build: (home) => [homeItem(home), { label: 'Approvers' }],
  },
  {
    test: (p) => p === '/company_admin/business-processes',
    build: (home) => [homeItem(home), { label: 'Business Processes' }],
  },
  {
    test: (p) => p === '/company_admin/racms',
    build: (home) => [homeItem(home), { label: 'RACM Dashboard' }],
  },
  {
    test: (p) => p === '/company_admin/ifc-report',
    build: (home) => [homeItem(home), { label: 'IFC Report' }],
  },
  {
    test: (p) => p === '/company_admin/company-details',
    build: (home) => [homeItem(home), { label: 'Company Details' }],
  },
  {
    test: (p) => /^\/company_admin\/form\/[^/]+$/.test(p),
    build: (home) => [
      homeItem(home),
      { label: 'RACM Dashboard', to: '/company_admin/racms' },
      { label: 'RACM' },
    ],
  },
  {
    test: (p) => p === '/company_admin/profile',
    build: (home) => [homeItem(home), { label: 'Profile' }],
  },

  // —— Siteadmin ——
  {
    test: (p) => p === '/siteadmin/create-company',
    build: (home) => [
      homeItem(home),
      { label: 'Companies', to: '/siteadmin/company-management' },
      { label: 'Create' },
    ],
  },
  {
    test: (p) => /^\/siteadmin\/company\/[^/]+$/.test(p),
    build: (home) => [
      homeItem(home),
      { label: 'Companies', to: '/siteadmin/company-management' },
      { label: 'Company' },
    ],
  },
  {
    test: (p) => p === '/siteadmin/company-management',
    build: (home) => [homeItem(home), { label: 'Companies' }],
  },
  {
    test: (p) => p === '/siteadmin/controls-library/upload',
    build: (home) => [
      homeItem(home),
      { label: 'Controls Library', to: '/siteadmin/controls-library' },
      { label: 'Upload' },
    ],
  },
  {
    test: (p) => /^\/siteadmin\/controls-library\/[^/]+$/.test(p),
    build: (home) => [
      homeItem(home),
      { label: 'Controls Library', to: '/siteadmin/controls-library' },
      { label: 'Edit' },
    ],
  },
  {
    test: (p) => p === '/siteadmin/controls-library',
    build: (home) => [homeItem(home), { label: 'Controls Library' }],
  },
  {
    test: (p) => p === '/siteadmin/business-processes',
    build: (home) => [homeItem(home), { label: 'Business Processes' }],
  },
  {
    test: (p) => p === '/siteadmin/auditors',
    build: (home) => [homeItem(home), { label: 'Auditors' }],
  },
  {
    test: (p) => p === '/siteadmin/user-queries',
    build: (home) => [homeItem(home), { label: 'User Queries' }],
  },
  {
    test: (p) => p === '/siteadmin/profile',
    build: (home) => [homeItem(home), { label: 'Profile' }],
  },

  // —— Auditor ——
  {
    test: (p) => p === '/auditor/dashboard' || p === '/auditor/companies' || p === '/auditor/users',
    build: (home) => [homeItem(home), { label: 'Companies' }],
  },
  {
    test: (p) => p === '/auditor/racms',
    build: (home) => [homeItem(home), { label: 'RACMs' }],
  },
  {
    test: (p) => /^\/auditor\/form\/[^/]+$/.test(p),
    build: (home) => [
      homeItem(home),
      { label: 'RACMs', to: '/auditor/racms' },
      { label: 'RACM' },
    ],
  },
  {
    test: (p) => p === '/auditor/profile',
    build: (home) => [homeItem(home), { label: 'Profile' }],
  },

  // —— Approver ——
  {
    test: (p) => p === '/approver/dashboard',
    build: (home) => [homeItem(home), { label: 'Dashboard' }],
  },
  {
    test: (p) => p === '/approver/company-details',
    build: (home) => [homeItem(home), { label: 'Company Details' }],
  },
  {
    test: (p) => /^\/approver\/form\/[^/]+$/.test(p),
    build: (home) => [
      homeItem(home),
      { label: 'Dashboard', to: '/approver/dashboard' },
      { label: 'RACM' },
    ],
  },
  {
    test: (p) => p === '/approver/profile',
    build: (home) => [homeItem(home), { label: 'Profile' }],
  },

  // —— User ——
  {
    test: (p) => p === '/user/dashboard',
    build: (home) => [homeItem(home), { label: 'Dashboard' }],
  },
  {
    test: (p) => p === '/user/company-details',
    build: (home) => [homeItem(home), { label: 'Company Details' }],
  },
  {
    test: (p) => /^\/user\/form\/[^/]+$/.test(p),
    build: (home) => [
      homeItem(home),
      { label: 'Dashboard', to: '/user/dashboard' },
      { label: 'RACM' },
    ],
  },
  {
    test: (p) => p === '/user/profile',
    build: (home) => [homeItem(home), { label: 'Profile' }],
  },
]

/**
 * @param {string} pathname
 * @returns {Array<{ label: string, to?: string }> | null}
 */
export function getDashboardBreadcrumbItems(pathname) {
  const path = normalizePath(pathname)
  const homePath = getHomePath(path)
  if (!homePath || path === homePath) return null

  for (const rule of BREADCRUMB_RULES) {
    if (rule.test(path)) {
      return rule.build(homePath)
    }
  }

  // Fallback: last path segment as muted active crumb
  const segment = path.split('/').filter(Boolean).pop() || 'Page'
  const label = segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

  return [homeItem(homePath), { label }]
}
