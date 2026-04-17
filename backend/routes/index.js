const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/companies', require('./companies'));
router.use('/company-co', require('./company_co'));
router.use('/control-forms', require('./control_forms'));
router.use('/approver', require('./approver/index'));
router.use('/stats', require('./stats'));

module.exports = router;