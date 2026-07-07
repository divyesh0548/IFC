function mapUserQueryToApi(record) {
  if (!record) return null;

  return {
    id: record.id,
    type_of_query: record.typeOfQuery,
    explanation: record.explanation,
    user_email_id: record.userEmailId,
    reviewed: record.reviewed,
    submitted_on: record.submittedOn,
    reviewed_on: record.reviewedOn,
    mail_sent_to_admin: record.mailSentToAdmin,
  };
}

module.exports = {
  mapUserQueryToApi,
};
