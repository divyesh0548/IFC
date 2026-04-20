const express = require('express');
const controller = require('../../controllers/company_co/company_co');
const { verifyCompanyCoordinator } = require('../../modules/auth/auth.middleware');

const router = express.Router();

router.get('/home-stats', verifyCompanyCoordinator, controller.getHomeStats);
router.get('/users', verifyCompanyCoordinator, controller.getUsers);
router.post('/create-user', verifyCompanyCoordinator, controller.createUser);
router.post('/create-users-bulk', verifyCompanyCoordinator, controller.createUsersBulk);
router.post('/delete-users', verifyCompanyCoordinator, controller.deleteUsers);
router.get('/check-user/:email', verifyCompanyCoordinator, controller.checkUser);
router.get('/check-user-role/:email', verifyCompanyCoordinator, controller.checkUserRole);
router.get('/racm-audit-logs/:form_id', verifyCompanyCoordinator, controller.getRacmAuditLogs);

module.exports = router;
