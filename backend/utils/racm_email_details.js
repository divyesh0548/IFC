function formatFieldLine(label, value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return `- ${label}: ${text}`;
}

function formatRequiredFieldLine(label, value) {
  const text = String(value || '').trim() || 'N/A';
  return `- ${label}: ${text}`;
}

function buildRacmDetailsSection(formLike, extraFields = [], heading = 'RACM Details:') {
  const lines = [heading];

  const primaryFields = [
    ['Business Process', formLike?.business_process ?? formLike?.businessProcess],
    ['Financial Year', formLike?.financial_year ?? formLike?.financialYear],
  ];

  for (const [label, value] of primaryFields) {
    lines.push(formatRequiredFieldLine(label, value));
  }

  for (const [label, value] of extraFields) {
    const line = formatFieldLine(label, value);
    if (line) {
      lines.push(line);
    }
  }

  return lines.join('\n');
}

function buildPendingApprovalRacmDetailsSection(formLike, { dueDate, submittedBy }) {
  return buildRacmDetailsSection(formLike, [
    ['Due Date', dueDate],
    ['Submitted By', submittedBy],
  ]);
}

function buildDeficiencyResponseDetailsSection({
  responseType,
  submittedBy,
  concernedPerson,
  dueDate,
  attachmentCount,
  reviewDecision,
  heading = 'Response Details:',
}) {
  const lines = [heading];
  const normalizedType = String(responseType || '').trim() === 'compensatory_racm'
    ? 'compensatory_racm'
    : 'mitigation_plan';

  if (normalizedType === 'compensatory_racm') {
    lines.push(formatRequiredFieldLine('Response Type', 'Compensatory RACM'));
    const count = Number.isFinite(Number(attachmentCount)) ? Number(attachmentCount) : 0;
    lines.push(formatRequiredFieldLine('Number of Documents Attached', count));
  } else {
    lines.push(formatRequiredFieldLine('Submitted By', submittedBy));
    lines.push(formatRequiredFieldLine('Concerned Person', concernedPerson));
    lines.push(formatRequiredFieldLine('Due Date', dueDate));
  }

  if (reviewDecision !== undefined && String(reviewDecision || '').trim() !== '') {
    lines.push(formatRequiredFieldLine('Review Decision', reviewDecision));
  }

  return lines.join('\n');
}

function resolveDeficiencyResponseEmailFields(deficiencyResponse) {
  const submission = deficiencyResponse?.current_submission || deficiencyResponse || {};
  const responseType = submission.submission_type || deficiencyResponse?.response_type;
  const attachments = Array.isArray(submission.attachments)
    ? submission.attachments
    : (Array.isArray(deficiencyResponse?.attachments) ? deficiencyResponse.attachments : []);

  return {
    responseType,
    submittedBy: submission.submitted_by_email || deficiencyResponse?.submitted_by_email,
    concernedPerson: submission.concerned_person || deficiencyResponse?.concerned_person,
    dueDate: submission.due_date || deficiencyResponse?.due_date,
    attachmentCount: attachments.length,
  };
}

module.exports = {
  buildRacmDetailsSection,
  buildPendingApprovalRacmDetailsSection,
  buildDeficiencyResponseDetailsSection,
  resolveDeficiencyResponseEmailFields,
};
