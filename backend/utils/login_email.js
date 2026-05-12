const { sendEmail } = require('./send_email');
const {
  encryptIfcUserTempPassword,
  decryptIfcUserTempPassword,
} = require('./ifc_user_password');

function encryptTempPassword(tempPassword) {
  return encryptIfcUserTempPassword(tempPassword);
}

function decryptTempPassword(encryptedTempPassword) {
  return decryptIfcUserTempPassword(encryptedTempPassword);
}

function roleLabel(role) {
  if (role === 'company_co') return 'Company Coordinator';
  if (role === 'approver') return 'Approver';
  if (role === 'siteadmin') return 'Site Admin';
  if (role === 'auditor') return 'Auditor';
  return 'User';
}

function formatNameFromEmail(emailId) {
  const raw = String(emailId || '').trim().toLowerCase();
  if (!raw) return 'User';
  const localPart = raw.split('@')[0] || '';
  const parts = localPart
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'User';
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getPortalUrl() {
  return process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
}

function buildUserCreationEmail({
  emailId,
  userName,
  coordinatorName,
  coordinatorEmail,
  companyName,
  tempPassword,
}) {
  const resolvedUserName = String(userName || '').trim() || formatNameFromEmail(emailId);
  const resolvedCoordinatorName =
    String(coordinatorName || '').trim() ||
    formatNameFromEmail(coordinatorEmail) ||
    'Company Coordinator';
  const resolvedCompanyName = String(companyName || '').trim() || 'IFC';
  const portalUrl = getPortalUrl();

  return {
    subject: "Welcome to IFC - Let's get started",
    text: `Hi ${resolvedUserName},

Hope you're having a good week!

I am ${resolvedCoordinatorName} at ${resolvedCompanyName} organization. We have been engaged to carry out an internal financial control review. This is a yearly exercise. If you have not participated before, we’ve put together a short introductory video (just a few minutes) to get you up to speed. You can watch it here: [Video Link]

Here is a brief overview of Internal Financial Controls.

Internal financial controls are the everyday steps we take to keep our financial information accurate and safe. IFC testing checks whether those steps are working.

The control flow is as follows: You upload evidence that you've performed the control. Our tester reviews it and passes or fails the control based on whether it is working effectively. That's it!

Your evidence is the proof that shows our controls are doing their job.

Here are your login credentials. (This is a temporary password, please change it after logging in.)

Email ID: ${emailId}
Password: ${tempPassword}
Portal: ${portalUrl}

Thanks & Regards,
${resolvedCoordinatorName}
Sharp and Tannan Associates`,
  };
}

function buildLoginEmail({ emailId, role, companyName, tempPassword }) {
  const displayRole = roleLabel(role);
  const frontendUrl = `${getPortalUrl()}/user/login`;
  const companyLine = companyName ? `\nCompany: ${companyName}\n` : '';

  return {
    subject: `Welcome to ${companyName || 'IFC'} - Your Temporary Login Credentials`,
    text: `Dear ${displayRole},

Your account has been created successfully.${companyLine}
Your temporary login credentials:
Email: ${emailId}
Temporary Password: ${tempPassword}

IMPORTANT: Please login using these credentials and update your password immediately for security purposes.

Login URL: ${frontendUrl}

After logging in, you will be prompted to update your temporary password to a permanent one.

Best regards,
IFC System`,
  };
}

async function markLoginEmailSent(client, userId) {
  await client.query(
    `
      UPDATE ifc_users
      SET login_email_sent = TRUE,
          temp_password_encrypted = NULL
      WHERE id = $1
    `,
    [userId]
  );
}

async function sendUserCreationEmail(client, {
  userId,
  emailId,
  userName,
  coordinatorName,
  coordinatorEmail,
  companyName,
  tempPassword,
}) {
  const emailPayload = buildUserCreationEmail({
    emailId,
    userName,
    coordinatorName,
    coordinatorEmail,
    companyName,
    tempPassword,
  });

  const sent = await sendEmail(emailId, emailPayload.subject, emailPayload.text);
  if (!sent) {
    return false;
  }

  await markLoginEmailSent(client, userId);
  return true;
}

async function sendPendingLoginEmail(client, userRow) {
  const emailId = String(userRow.email_id || '').trim();
  if (!emailId || !userRow.temp_password_encrypted) {
    return false;
  }

  const tempPassword = decryptTempPassword(userRow.temp_password_encrypted);
  const emailPayload = buildLoginEmail({
    emailId,
    role: userRow.role,
    companyName: userRow.company_name,
    tempPassword,
  });

  const sent = await sendEmail(emailId, emailPayload.subject, emailPayload.text);
  if (!sent) {
    return false;
  }

  await markLoginEmailSent(client, userRow.id);

  return true;
}

module.exports = {
  encryptTempPassword,
  decryptTempPassword,
  buildLoginEmail,
  buildUserCreationEmail,
  sendUserCreationEmail,
  sendPendingLoginEmail,
};
