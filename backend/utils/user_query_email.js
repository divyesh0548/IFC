const ALLOWED_QUERY_TYPES = new Set(['Website Issue', 'Suggestion']);

function buildUserQueryAdminEmail({ query }) {
  const typeOfQuery = String(query?.type_of_query || '').trim();
  const explanation = String(query?.explanation || '').trim();
  const email = String(query?.user_email_id || '').trim() || '-';

  return {
    subject: `New User Query - ${typeOfQuery}`,
    text: `A new user query has been submitted on the IFC portal.

Submitted by: ${email}
Explanation: ${explanation}`,
  };
}

module.exports = {
  ALLOWED_QUERY_TYPES,
  buildUserQueryAdminEmail,
};
