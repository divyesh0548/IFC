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
  if (role === 'company_admin') return 'Company Admin';
  if (role === 'company_co') return 'Company Coordinator';
  if (role === 'approver') return 'Approver';
  if (role === 'siteadmin') return 'Site Admin';
  if (role === 'auditor') return 'Auditor';
  return 'User';
}

function getPortalUrl() {
  return process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
}

function buildUserCreationEmail({
  emailId,
  role,
  userName,
  coordinatorName,
  coordinatorEmail,
  companyName,
  tempPassword,
}) {
  const genericGreetingLabel = String(role || '').trim().toLowerCase() === 'approver' ? 'Approver' : 'User';
  const resolvedUserName = String(userName || '').trim() || genericGreetingLabel;
  const resolvedCoordinatorName =
    String(coordinatorName || '').trim() ||
    'Company Admin';
  const resolvedCompanyName = String(companyName || '').trim() || 'IFC';
  const portalUrl = getPortalUrl();
  const normalizedRole = String(role || '').trim().toLowerCase();

  if (normalizedRole === 'company_admin') {
    return {
      subject: `Welcome to ${resolvedCompanyName} - Your Company Admin Account`,
      text: `Hi ${resolvedUserName},

Your account has been created for company ${resolvedCompanyName}.

As Company Admin, you can create and manage units for ${resolvedCompanyName}, add coordinators and approvers, and manage their assignments across the company.

Here are your login credentials. (This is a temporary password, please change it after logging in.)

Email ID: ${emailId}
Password: ${tempPassword}
Portal: ${portalUrl}

If you need any assistance during setup, please reach out to the implementation team.

Thanks & Regards,
${resolvedCoordinatorName}`,
    };
  }

  if (normalizedRole === 'company_co') {
    return {
      subject: "Welcome to IFC - Let's get started",
      text: `Hi ${resolvedUserName},

Hope you're having a good week!

I am ${resolvedCoordinatorName} at ${resolvedCompanyName} organization. We have been engaged to carry out an internal financial control review. This is a yearly exercise. If you have not participated before, we’ve put together a short introductory video (just a few minutes) to get you up to speed. You can watch it here: [Video Link]

You have been assigned as Company Coordinator in ${resolvedCompanyName}

Here is a brief overview of Internal Financial Controls.

Internal financial controls are the everyday steps we take to keep our financial information accurate and safe. IFC testing checks whether those steps are working.

The control flow is as follows: Process Owner upload evidence that they have performed the control. Tester will reviews it and passes or fails the control based on whether it is working effectively. That's it!

Here are your login credentials. (This is a temporary password, please change it after logging in.)

Email ID: ${emailId}
Password: ${tempPassword}
Portal: ${portalUrl}

Thanks & Regards,
${resolvedCoordinatorName}
Sharp and Tannan Associates`,
    };
  }

  if (normalizedRole === 'approver') {
    return {
      subject: "Welcome to IFC - Let's get started",
      text: `Hi ${resolvedUserName},

Hope you're having a good week!

I am ${resolvedCoordinatorName} at ${resolvedCompanyName} organization. We have been engaged to carry out an internal financial control review. This is a yearly exercise. If you have not participated before, we’ve put together a short introductory video (just a few minutes) to get you up to speed. You can watch it here: [Video Link]

You have been assigned as approver in ${resolvedCompanyName}

Here is a brief overview of Internal Financial Controls.

Internal financial controls are the everyday steps we take to keep our financial information accurate and safe. IFC testing checks whether those steps are working.

The control flow is as follows: Process Owner upload evidence that they have performed the control. Tester will reviews it and passes or fails the control based on whether it is working effectively. That's it!

Here are your login credentials. (This is a temporary password, please change it after logging in.)

Email ID: ${emailId}
Password: ${tempPassword}
Portal: ${portalUrl}

Thanks & Regards,
${resolvedCoordinatorName}
Sharp and Tannan Associates`,
    };
  }

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
  role,
  userName,
  coordinatorName,
  coordinatorEmail,
  companyName,
  tempPassword,
}) {
  const emailPayload = buildUserCreationEmail({
    emailId,
    role,
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
