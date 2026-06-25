async function validateRacmUnitUserAssignment(clientOrPool, {
  companyIdentifier,
  unitId,
  email,
  fieldLabel = 'User',
  requireUserRole = true,
}) {
  const normalizedEmail = String(email || '').trim();
  if (!normalizedEmail) {
    return { ok: true };
  }

  const companyId = String(companyIdentifier || '').trim();
  const normalizedUnitId = String(unitId || '').trim();

  if (!companyId || !normalizedUnitId) {
    return {
      ok: false,
      message: `${fieldLabel} requires a unit to be selected`,
    };
  }

  const result = await clientOrPool.query(
    `
      SELECT u.role
      FROM ifc_users u
      INNER JOIN user_unit_memberships uum
        ON uum.company_identifier = u.company_identifier
       AND LOWER(TRIM(uum.user_email_id)) = LOWER(TRIM(u.email_id))
       AND uum.unit_id = $3
      WHERE LOWER(TRIM(u.email_id)) = LOWER(TRIM($1))
        AND u.company_identifier = $2
      LIMIT 1
    `,
    [normalizedEmail, companyId, normalizedUnitId]
  );

  if (result.rows.length === 0) {
    return {
      ok: false,
      message: `${fieldLabel} must be a user assigned to the selected unit`,
    };
  }

  const role = String(result.rows[0]?.role || '').trim().toLowerCase();
  if (requireUserRole && role !== 'user') {
    return {
      ok: false,
      message: `${fieldLabel} must be a normal user`,
    };
  }

  return { ok: true };
}

module.exports = {
  validateRacmUnitUserAssignment,
};
