const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/siteadmin', require('./siteadmin/index'));
router.use('/company-co', require('./company_co/index'));
router.use('/control-forms', require('./control_forms'));
router.use('/approver', require('./approver/index'));
router.use('/auditor', require('./auditor/index'));
router.use('/stats', require('./stats'));

module.exports = router;
