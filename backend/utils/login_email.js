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

function buildLoginEmail({ emailId, role, companyName, tempPassword }) {
  const displayRole = roleLabel(role);
  const frontendUrl = process.env.VITE_FRONTEND_URL || 'http://localhost:5173/user/login';
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

  await client.query(
    `
      UPDATE ifc_users
      SET login_email_sent = TRUE,
          temp_password_encrypted = NULL
      WHERE id = $1
    `,
    [userRow.id]
  );

  return true;
}

module.exports = {
  encryptTempPassword,
  decryptTempPassword,
  buildLoginEmail,
  sendPendingLoginEmail,
};
