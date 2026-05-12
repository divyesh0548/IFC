const express = require('express');
const { verifyAuthenticatedUser } = require('../modules/auth/auth.middleware');
const { listBusinessProcessesForCompany } = require('../utils/business_process_master');

const router = express.Router();

router.get('/', verifyAuthenticatedUser, async (req, res) => {
  try {
    const companyIdentifier = req.user?.role === 'siteadmin'
      ? null
      : req.user?.company_identifier || null;
    const data = await listBusinessProcessesForCompany(undefined, companyIdentifier);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get business processes error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch business processes',
    });
  }
});

module.exports = router;
