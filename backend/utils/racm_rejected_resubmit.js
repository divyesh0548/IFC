const { prisma } = require('../lib/prisma');

const REJECTED_RESUBMIT_MESSAGE =
  'Rejected RACMs require updated remarks and newly uploaded documents before resubmitting for approval.';

function resolveLastRejectedAt(currentForm) {
  return currentForm?.lastRejectedAt ?? currentForm?.last_rejected_at ?? null;
}

function hasRemarksChanged(currentForm, remarks_by_user) {
  if (remarks_by_user === undefined) {
    return false;
  }
  return String(remarks_by_user ?? '').trim() !== String(currentForm?.remarksByUser ?? currentForm?.remarks_by_user ?? '').trim();
}

async function hasNewDocumentSinceRejection({
  formId,
  rejectionTs,
  hasUserDocumentUpload,
}) {
  if (hasUserDocumentUpload) {
    return true;
  }

  if (!rejectionTs) {
    return false;
  }

  const rejectionTime = new Date(rejectionTs).getTime();
  if (Number.isNaN(rejectionTime)) {
    return false;
  }

  const docs = await prisma.racmDoc.findMany({
    where: { formId: String(formId || '').trim() },
    select: { createdAt: true },
  });

  return docs.some((doc) => {
    if (!doc.createdAt) return false;
    return new Date(doc.createdAt).getTime() > rejectionTime;
  });
}

async function validateRejectedRacmResubmit({
  formId,
  currentForm,
  remarks_by_user,
  hasUserDocumentUpload,
}) {
  const currentStatus = String(currentForm?.status || '').trim().toLowerCase();
  if (currentStatus !== 'rejected') {
    return { ok: true };
  }

  const remarksChanged = hasRemarksChanged(currentForm, remarks_by_user);
  const rejectionTs = resolveLastRejectedAt(currentForm);
  const hasNewDoc = await hasNewDocumentSinceRejection({
    formId,
    rejectionTs,
    hasUserDocumentUpload,
  });

  if (remarksChanged && hasNewDoc) {
    return { ok: true };
  }

  return { ok: false, message: REJECTED_RESUBMIT_MESSAGE };
}

module.exports = {
  validateRejectedRacmResubmit,
  REJECTED_RESUBMIT_MESSAGE,
  hasRemarksChanged,
  hasNewDocumentSinceRejection,
  resolveLastRejectedAt,
};
