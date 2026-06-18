const UNIT_RESPONSIBILITY_TYPES = {
  COORDINATOR: 'COORDINATOR',
  APPROVER: 'APPROVER',
};

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getUnitResponsibilityConfig(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();

  if (normalizedRole === 'company_co') {
    return {
      role: 'company_co',
      responsibilityType: UNIT_RESPONSIBILITY_TYPES.COORDINATOR,
      roleLabel: 'Company Coordinator',
    };
  }

  if (normalizedRole === 'approver') {
    return {
      role: 'approver',
      responsibilityType: UNIT_RESPONSIBILITY_TYPES.APPROVER,
      roleLabel: 'Approver',
    };
  }

  return null;
}

function getResponsibilityTypeForRole(role) {
  return getUnitResponsibilityConfig(role)?.responsibilityType || null;
}

module.exports = {
  UNIT_RESPONSIBILITY_TYPES,
  normalizeEmail,
  getUnitResponsibilityConfig,
  getResponsibilityTypeForRole,
};
