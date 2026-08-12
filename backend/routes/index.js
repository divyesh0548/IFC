const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/siteadmin', require('./siteadmin/index'));
router.use('/company-admin', require('./company_admin/index'));
router.use('/company-co', require('./company_co/index'));
router.use('/control-forms', require('./control_form/index'));
router.use('/approver', require('./approver/index'));
router.use('/auditor', require('./auditor/index'));
router.use('/stats', require('./stats'));
router.use('/business-processes', require('./business_processes'));
router.use('/controls-library', require('./controls_library'));
router.use('/user-queries', require('./user_queries'));

module.exports = router;
