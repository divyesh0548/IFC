const nodemailer = require('nodemailer');

/**
 * Send plain-text email via SMTP.
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {{ cc?: string[] | string }} [options]
 * @returns {Promise<boolean>}
 */
async function sendEmail(to, subject, text, options = {}) {
  if (!to || !String(to).trim()) {
    return false;
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error(
      'SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS environment variables.'
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3',
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: String(to).trim(),
    subject,
    text,
  };
  const ccList = Array.isArray(options.cc)
    ? options.cc.map((email) => String(email || '').trim()).filter(Boolean)
    : (options.cc ? [String(options.cc).trim()] : []);
  if (ccList.length > 0) {
    mailOptions.cc = ccList.join(', ');
  }

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error(
        `SMTP Connection Error: Cannot connect to ${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || 587}`
      );
      console.error('Possible causes:');
      console.error('1. SMTP server is not accessible (check firewall/network)');
      console.error('2. Incorrect SMTP_HOST or SMTP_PORT');
      console.error('3. SMTP server is down or unreachable');
      console.error('4. Network connectivity issues');
      console.error('5. For Gmail: Check if "Less secure app access" is enabled or use App Password');
    } else if (error.code === 'EAUTH') {
      console.error('SMTP Authentication Error: Invalid credentials');
      console.error('Please check SMTP_USER and SMTP_PASS environment variables');
      console.error('For Gmail: Use App Password instead of regular password');
    } else if (error.responseCode === 535) {
      console.error('SMTP Authentication Error: Invalid username or password');
      console.error('For Gmail: Make sure to use App Password, not your regular Gmail password');
    } else {
      console.error('SMTP Error Details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
      });
    }

    return false;
  }
}

module.exports = { sendEmail };
