const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();

// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'divyesh',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ifc_dev',
  password: String(process.env.DB_PASSWORD || '0548'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Set timezone to IST for all connections
pool.on('connect', async (client) => {
  await client.query("SET timezone = 'Asia/Kolkata'");
});

// Helper function to decrypt JWT token
function decryptToken(encryptedToken) {
  try {
    const algorithm = 'aes-256-gcm';
    const encryptionKeyHex = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    const encryptionKey = Buffer.from(encryptionKeyHex.slice(0, 64), 'hex');
    
    // Split the encrypted token
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Token decryption failed');
  }
}

// Middleware to verify approver authentication
async function verifyApproverAuth(req, res, next) {
  try {
    const token = req.cookies.approverAuthToken;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Decrypt the token
    const decryptedToken = decryptToken(token);
    
    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    const decoded = jwt.verify(decryptedToken, jwtSecret);
    
    // Verify approver exists in database
    const approverQuery = 'SELECT id, email_id FROM appover WHERE email_id = $1';
    const approverResult = await pool.query(approverQuery, [decoded.email_id]);
    
    if (approverResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Approver not found'
      });
    }
    
    // Attach approver info to request object
    req.approver = approverResult.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    console.error('Approver authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
}

// Protected route: Get approver dashboard data
router.get('/dashboard', verifyApproverAuth, async (req, res) => {
  try {
    // Get approver info from middleware
    const approver = req.approver;
    
    // You can add dashboard-specific queries here
    // For example, get pending approvals, statistics, etc.
    
    res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      approver: {
        id: approver.id,
        email_id: approver.email_id
      },
      // Add dashboard data here
      data: {
        // Example: pendingApprovals: [],
        // Example: statistics: {}
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Protected route: Get pending control forms for approval
router.get('/pending-approvals', verifyApproverAuth, async (req, res) => {
  try {
    // Get control forms that are pending approval
    const query = `
      SELECT * FROM control_forms 
      WHERE status IS NULL OR status = '' OR status = 'sent for approval'
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.status(200).json({
      success: true,
      message: 'Pending approvals retrieved successfully',
      data: result.rows
    });
  } catch (error) {
    console.error('Pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Protected route: Approve or reject a control form
router.post('/approve-form/:form_id', verifyApproverAuth, async (req, res) => {
  try {
    const { form_id } = req.params;
    const { status, reason_by_approver } = req.body;
    const approver = req.approver;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be either "Approved" or "Rejected"'
      });
    }

    // Update the control form
    const updateQuery = `
      UPDATE control_forms 
      SET status = $1, 
          reason_by_approver = $2
      WHERE form_id = $3
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, [
      status,
      reason_by_approver || null,
      form_id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Control form not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Form ${status.toLowerCase()} successfully`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Approve form error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Protected route: Get all control forms (with filter options)
router.get('/control-forms', verifyApproverAuth, async (req, res) => {
  try {
    const { status, active } = req.query;
    
    let query = 'SELECT * FROM control_forms WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (active !== undefined) {
      query += ` AND active = $${paramIndex}`;
      queryParams.push(active === 'true' ? 'true' : 'false');
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, queryParams);

    res.status(200).json({
      success: true,
      message: 'Control forms retrieved successfully',
      data: result.rows
    });
  } catch (error) {
    console.error('Get control forms error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Protected route: Get a specific control form by form_id
router.get('/control-forms/:form_id', verifyApproverAuth, async (req, res) => {
  try {
    const { form_id } = req.params;
    
    const query = 'SELECT * FROM control_forms WHERE form_id = $1';
    const result = await pool.query(query, [form_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Control form not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Control form retrieved successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get control form error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;

