const express = require('express');
const controller = require('../../controllers/auditor/auditor');
const { verifyAuditorAuth } = require('../../modules/auth/auth.middleware');

const router = express.Router();

router.get('/home-stats', verifyAuditorAuth, controller.getHomeStats);
router.get('/companies', verifyAuditorAuth, controller.getCompanies);
router.get('/users', verifyAuditorAuth, controller.getUsers);
router.get('/racms', verifyAuditorAuth, controller.getRacms);

module.exports = router;
