const jwt = require('jsonwebtoken');
const { decryptToken } = require('../../utils/auth_utility');
const { pool } = require('../../utils/db');
const { clearAuthCookies } = require('./auth.cookies');
const { createdAtUtcSql } = require('../../utils/sqlUtcTimestamps');

function clearCookiesAndRespondAuthError(res, statusCode, message) {
  clearAuthCookies(res);
  return res.status(statusCode).json({
    success: false,
    message,
  });
}

/**
 * Resolve `email_id` from encrypted JWT cookies (unified `authToken` plus legacy names).
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getEmailFromAuthCookies(req) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return null;
  }
  const tokenCandidates = [
    req.cookies.authToken,
    req.cookies.userAuthToken,
    req.cookies.approverAuthToken,
    req.cookies.auditorAuthToken,
    req.cookies.siteadminAuthToken,
  ].filter(Boolean);

  for (const token of tokenCandidates) {
    try {
      const decryptedToken = decryptToken(token);
      const decoded = jwt.verify(decryptedToken, jwtSecret);
      if (decoded && decoded.email_id) {
        return decoded.email_id;
      }
    } catch (_) {
      // try next cookie
    }
  }
  return null;
}

async function ensurePrivilegedUserHasAssignment(user) {
  const normalizedRole = String(user?.role || '').trim().toLowerCase();
  const companyIdentifier = user?.company_identifier || null;
  const emailId = String(user?.email_id || '').trim().toLowerCase();

  if (!companyIdentifier || !emailId || !['company_co', 'approver'].includes(normalizedRole)) {
    return true;
  }

  const assignmentQuery = normalizedRole === 'company_co'
    ? `
      SELECT 1
      FROM coordinator_unit_assignments
      WHERE company_identifier = $1
        AND LOWER(TRIM(coordinator_email_id)) = $2
      LIMIT 1
    `
    : `
      SELECT 1
      FROM approver_assignments
      WHERE company_identifier = $1
        AND LOWER(TRIM(approver_email_id)) = $2
      LIMIT 1
    `;
  const result = await pool.query(assignmentQuery, [companyIdentifier, emailId]);

  return result.rows.length > 0;
}

async function getAuthenticatedUserFromAnyCookie(req) {
  const emailId = getEmailFromAuthCookies(req);
  if (!emailId) {
    return null;
  }

  const userResult = await pool.query(
    'SELECT id, email_id, role, company_identifier FROM ifc_users WHERE email_id = $1 LIMIT 1',
    [emailId]
  );

  if (userResult.rows.length === 0) {
    return null;
  }

  return userResult.rows[0];
}

/** Company coordinator only (`ifc_users.role === 'company_co'`). */
async function verifyCompanyCoordinator(req, res, next) {
  try {
    const token = req.cookies.authToken || req.cookies.userAuthToken;

    if (!token) {
      return clearCookiesAndRespondAuthError(res, 401, 'Authentication required');
    }

    const jwtSecret = process.env.JWT_SECRET;
    const decoded = jwt.verify(decryptToken(token), jwtSecret);

    const userQuery = `SELECT *, ${createdAtUtcSql('created_at')} FROM ifc_users WHERE email_id = $1`;
    const userResult = await pool.query(userQuery, [decoded.email_id]);

    if (userResult.rows.length === 0) {
      return clearCookiesAndRespondAuthError(res, 401, 'User not found');
    }

    const user = userResult.rows[0];

    if (user.role !== 'company_co') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Company coordinator role required.',
      });
    }

    if (!(await ensurePrivilegedUserHasAssignment(user))) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not yet assigned',
      });
    }

    req.user = user;
    console.log('✅ Company coordinator verified successfully, user:', user.email_id, 'role:', user.role);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      console.error('❌ Invalid or expired token:', error.message);
      return clearCookiesAndRespondAuthError(res, 401, 'Invalid or expired token');
    }

    console.error('❌ Token verification failed:', error.message);
    return clearCookiesAndRespondAuthError(res, 401, 'Token verification failed');
  }
}

/** Company admin only (`ifc_users.role === 'company_admin'`). */
async function verifyCompanyAdmin(req, res, next) {
  try {
    const token = req.cookies.authToken || req.cookies.userAuthToken;

    if (!token) {
      return clearCookiesAndRespondAuthError(res, 401, 'Authentication required');
    }

    const jwtSecret = process.env.JWT_SECRET;
    const decoded = jwt.verify(decryptToken(token), jwtSecret);

    const userResult = await pool.query(
      `SELECT *, ${createdAtUtcSql('created_at')} FROM ifc_users WHERE email_id = $1`,
      [decoded.email_id]
    );
    if (userResult.rows.length === 0) {
      return clearCookiesAndRespondAuthError(res, 401, 'User not found');
    }

    const user = userResult.rows[0];
    if (user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Company admin role required.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return clearCookiesAndRespondAuthError(res, 401, 'Invalid or expired token');
    }

    console.error('Company admin authentication error:', error);
    return clearCookiesAndRespondAuthError(res, 401, 'Authentication failed');
  }
}

/** Approver only (`ifc_users.role === 'approver'`). Sets `req.approver` and `req.user`. */
async function verifyApproverAuth(req, res, next) {
  try {
    const token = req.cookies.authToken || req.cookies.approverAuthToken;

    if (!token) {
      return clearCookiesAndRespondAuthError(res, 401, 'Authentication required');
    }

    const decryptedToken = decryptToken(token);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    const decoded = jwt.verify(decryptedToken, jwtSecret);

    const userQuery = 'SELECT id, email_id, role, company_identifier FROM ifc_users WHERE email_id = $1';
    const userResult = await pool.query(userQuery, [decoded.email_id]);

    if (userResult.rows.length === 0) {
      return clearCookiesAndRespondAuthError(res, 401, 'User not found');
    }

    const user = userResult.rows[0];

    if (user.role !== 'approver') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Approver role required.',
      });
    }

    if (!(await ensurePrivilegedUserHasAssignment(user))) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not yet assigned',
      });
    }

    req.approver = {
      id: user.id,
      email_id: user.email_id,
    };

    req.user = {
      id: user.id,
      email_id: user.email_id,
      role: user.role,
      company_identifier: user.company_identifier,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return clearCookiesAndRespondAuthError(res, 401, 'Invalid or expired token');
    }

    console.error('Approver authentication error:', error);
    return clearCookiesAndRespondAuthError(res, 401, 'Authentication failed');
  }
}

/** User only (`ifc_users.role === 'user'`). */
async function verifyUserAuth(req, res, next) {
  try {
    const token = req.cookies.authToken || req.cookies.userAuthToken;

    if (!token) {
      return clearCookiesAndRespondAuthError(res, 401, 'Authentication required');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    const decoded = jwt.verify(decryptToken(token), jwtSecret);
    const userQuery = 'SELECT id, email_id, role, company_identifier FROM ifc_users WHERE email_id = $1';
    const userResult = await pool.query(userQuery, [decoded.email_id]);

    if (userResult.rows.length === 0) {
      return clearCookiesAndRespondAuthError(res, 401, 'User not found');
    }

    const user = userResult.rows[0];
    if (user.role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. User role required.',
      });
    }

    req.user = {
      id: user.id,
      email_id: user.email_id,
      role: user.role,
      company_identifier: user.company_identifier,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return clearCookiesAndRespondAuthError(res, 401, 'Invalid or expired token');
    }
    console.error('User authentication error:', error);
    return clearCookiesAndRespondAuthError(res, 401, 'Authentication failed');
  }
}

/** Siteadmin only (`ifc_users.role === 'siteadmin'`). */
async function verifySiteadminAuth(req, res, next) {
  try {
    const token = req.cookies.authToken || req.cookies.siteadminAuthToken;

    if (!token) {
      return clearCookiesAndRespondAuthError(res, 401, 'Authentication required');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    const decoded = jwt.verify(decryptToken(token), jwtSecret);
    const userQuery = 'SELECT id, email_id, role, company_identifier FROM ifc_users WHERE email_id = $1';
    const userResult = await pool.query(userQuery, [decoded.email_id]);

    if (userResult.rows.length === 0) {
      return clearCookiesAndRespondAuthError(res, 401, 'User not found');
    }

    const user = userResult.rows[0];
    if (user.role !== 'siteadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Siteadmin role required.',
      });
    }

    req.user = {
      id: user.id,
      email_id: user.email_id,
      role: user.role,
      company_identifier: user.company_identifier,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return clearCookiesAndRespondAuthError(res, 401, 'Invalid or expired token');
    }
    console.error('Siteadmin authentication error:', error);
    return clearCookiesAndRespondAuthError(res, 401, 'Authentication failed');
  }
}

/** Auditor only (`ifc_users.role === 'auditor'`). */
async function verifyAuditorAuth(req, res, next) {
  try {
    const token = req.cookies.authToken || req.cookies.auditorAuthToken;

    if (!token) {
      return clearCookiesAndRespondAuthError(res, 401, 'Authentication required');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    const decoded = jwt.verify(decryptToken(token), jwtSecret);
    const userQuery = 'SELECT id, email_id, role, company_identifier FROM ifc_users WHERE email_id = $1';
    const userResult = await pool.query(userQuery, [decoded.email_id]);

    if (userResult.rows.length === 0) {
      return clearCookiesAndRespondAuthError(res, 401, 'User not found');
    }

    const user = userResult.rows[0];
    if (user.role !== 'auditor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Auditor role required.',
      });
    }

    req.user = {
      id: user.id,
      email_id: user.email_id,
      role: user.role,
      company_identifier: user.company_identifier,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return clearCookiesAndRespondAuthError(res, 401, 'Invalid or expired token');
    }
    console.error('Auditor authentication error:', error);
    return clearCookiesAndRespondAuthError(res, 401, 'Authentication failed');
  }
}

/** Any authenticated IFC user role. */
async function verifyAuthenticatedUser(req, res, next) {
  try {
    const user = await getAuthenticatedUserFromAnyCookie(req);

    if (!user) {
      return clearCookiesAndRespondAuthError(res, 401, 'Authentication required');
    }

    if (['company_co', 'approver'].includes(String(user.role || '').trim().toLowerCase())) {
      if (!(await ensurePrivilegedUserHasAssignment(user))) {
        return res.status(403).json({
          success: false,
          message: 'Your account is not yet assigned',
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authenticated user verification error:', error);
    return clearCookiesAndRespondAuthError(res, 401, 'Authentication failed');
  }
}

module.exports = {
  clearCookiesAndRespondAuthError,
  getEmailFromAuthCookies,
  verifyCompanyAdmin,
  verifyCompanyCoordinator,
  verifyApproverAuth,
  verifyUserAuth,
  verifySiteadminAuth,
  verifyAuditorAuth,
  verifyAuthenticatedUser,
};
