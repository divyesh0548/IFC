const ACTIVE_RACM_DELETE_MESSAGE =
  'Active RACM cannot be deleted. Please set the RACM Inactive first.';

function isRacmMarkedActive(active) {
  if (active === true || active === 1) {
    return true;
  }
  if (active === false || active === 0 || active == null) {
    return false;
  }
  const normalized = String(active).trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function getActiveRacmDeleteError(active) {
  return isRacmMarkedActive(active) ? ACTIVE_RACM_DELETE_MESSAGE : null;
}

const INACTIVE_RACM_APPROVER_MESSAGE =
  'Inactive RACMs cannot be accessed or reviewed by approvers.';

function getInactiveRacmApproverAccessError(active) {
  return isRacmMarkedActive(active) ? null : INACTIVE_RACM_APPROVER_MESSAGE;
}

async function deleteApproverAssignmentsForRacms(tx, { formIds, companyIdentifier = null }) {
  const normalizedFormIds = [...new Set(
    (Array.isArray(formIds) ? formIds : [formIds])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )];
  if (normalizedFormIds.length === 0) {
    return 0;
  }

  const where = {
    formId: { in: normalizedFormIds },
  };
  const normalizedCompanyIdentifier = String(companyIdentifier || '').trim();
  if (normalizedCompanyIdentifier) {
    where.companyIdentifier = normalizedCompanyIdentifier;
  }

  const result = await tx.approverAssignment.deleteMany({ where });
  return result.count;
}

module.exports = {
  ACTIVE_RACM_DELETE_MESSAGE,
  INACTIVE_RACM_APPROVER_MESSAGE,
  isRacmMarkedActive,
  getActiveRacmDeleteError,
  getInactiveRacmApproverAccessError,
  deleteApproverAssignmentsForRacms,
};
