function shouldAutoActivateRacmOnCreate({
  controlOwner,
  dueDate,
  reminderFrequency,
  ownerValidationResult,
}) {
  const ownerEmail = String(controlOwner || '').trim();
  const hasDueDate = Boolean(String(dueDate || '').trim());
  const hasReminderFrequency = Boolean(String(reminderFrequency || '').trim());

  if (!ownerEmail || !hasDueDate || !hasReminderFrequency) {
    return false;
  }

  if (!ownerValidationResult?.ok) {
    return false;
  }

  return true;
}

module.exports = {
  shouldAutoActivateRacmOnCreate,
}
