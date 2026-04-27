const jwt = require('jsonwebtoken');
const { decryptToken } = require('../../utils/auth_utility');
const { pool } = require('../../utils/db');

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

/** Company coordinator only (`ifc_users.role === 'company_co'`). */
async function verifyCompanyCoordinator(req, res, next) {
  try {
    const token = req.cookies.authToken || req.cookies.userAuthToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    const decoded = jwt.verify(decryptToken(token), jwtSecret);

    const userQuery = 'SELECT * FROM ifc_users WHERE email_id = $1';
    const userResult = await pool.query(userQuery, [decoded.email_id]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];

    if (user.role !== 'company_co') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Company coordinator role required.',
      });
    }

    req.user = user;
    console.log('✅ Company coordinator verified successfully, user:', user.email_id, 'role:', user.role);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      console.error('❌ Invalid or expired token:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    console.error('❌ Token verification failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Token verification failed',
    });
  }
}

/** Approver only (`ifc_users.role === 'approver'`). Sets `req.approver` and `req.user`. */
async function verifyApproverAuth(req, res, next) {
  try {
    const token = req.cookies.authToken || req.cookies.approverAuthToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
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
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];

    if (user.role !== 'approver') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Approver role required.',
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
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    console.error('Approver authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
}

/** User only (`ifc_users.role === 'user'`). */
async function verifyUserAuth(req, res, next) {
  try {
    const token = req.cookies.authToken || req.cookies.userAuthToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
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
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
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
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
    console.error('User authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
}

/** Siteadmin only (`ifc_users.role === 'siteadmin'`). */
async function verifySiteadminAuth(req, res, next) {
  try {
    const token = req.cookies.authToken || req.cookies.siteadminAuthToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
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
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
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
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
    console.error('Siteadmin authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
}

/** Auditor only (`ifc_users.role === 'auditor'`). */
async function verifyAuditorAuth(req, res, next) {
  try {
    const token = req.cookies.authToken || req.cookies.auditorAuthToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
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
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
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
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
    console.error('Auditor authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
}

module.exports = {
  getEmailFromAuthCookies,
  verifyCompanyCoordinator,
  verifyApproverAuth,
  verifyUserAuth,
  verifySiteadminAuth,
  verifyAuditorAuth,
};
