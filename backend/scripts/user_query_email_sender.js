const { prisma } = require('../lib/prisma');
const { sendEmail } = require('../utils/send_email');
const { buildUserQueryAdminEmail } = require('../utils/user_query_email');
const { mapUserQueryToApi } = require('../utils/user_query');

async function runPendingUserQueryEmails() {
  const pendingRows = await prisma.userQuery.findMany({
    where: { mailSentToAdmin: false },
    orderBy: [
      { submittedOn: 'asc' },
      { id: 'asc' },
    ],
  });

  if (pendingRows.length === 0) return;

  const siteadminUsers = await prisma.ifcUser.findMany({
    where: { role: 'siteadmin' },
    select: { emailId: true },
    orderBy: { emailId: 'asc' },
  });

  const siteadminEmails = siteadminUsers
    .map((row) => String(row.emailId || '').trim())
    .filter(Boolean);

  if (siteadminEmails.length === 0) {
    console.warn('[user-query-email] No siteadmin recipients configured');
    return;
  }

  for (const row of pendingRows) {
    const payload = buildUserQueryAdminEmail({
      query: mapUserQueryToApi(row),
    });

    try {
      let allSent = true;
      for (const adminEmail of siteadminEmails) {
        const emailSent = await sendEmail(adminEmail, payload.subject, payload.text);
        if (!emailSent) {
          allSent = false;
          console.warn(`[user-query-email] Failed email for query ${row.id} to ${adminEmail}`);
        }
      }

      if (!allSent) continue;

      await prisma.userQuery.update({
        where: { id: row.id },
        data: { mailSentToAdmin: true },
      });
      console.log(`[user-query-email] Notification sent for query ${row.id}`);
    } catch (error) {
      console.error(`[user-query-email] Error processing query ${row.id}:`, error);
    }
  }
}

module.exports = { runPendingUserQueryEmails };
