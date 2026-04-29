const express = require('express');
const controller = require('../../controllers/company_co/company_co');
const { verifyCompanyCoordinator } = require('../../modules/auth/auth.middleware');

const router = express.Router();

router.get('/home-stats', verifyCompanyCoordinator, controller.getHomeStats);
router.get('/unit-management', verifyCompanyCoordinator, controller.getUnitManagement);
router.post('/unit-management/units', verifyCompanyCoordinator, controller.createCompanyUnit);
router.patch('/unit-management/units/:unit_id/assignment', verifyCompanyCoordinator, controller.updateUnitAssignment);
router.post('/unit-management/coordinators', verifyCompanyCoordinator, controller.createUnitCoordinator);
router.post('/unit-management/approvers', verifyCompanyCoordinator, controller.createUnitApprover);
router.get('/users', verifyCompanyCoordinator, controller.getUsers);
router.post('/create-user', verifyCompanyCoordinator, controller.createUser);
router.post('/create-users-bulk', verifyCompanyCoordinator, controller.createUsersBulk);
router.post('/delete-users', verifyCompanyCoordinator, controller.deleteUsers);
router.get('/check-user/:email', verifyCompanyCoordinator, controller.checkUser);
router.get('/check-user-role/:email', verifyCompanyCoordinator, controller.checkUserRole);
router.get('/racm-audit-logs/:form_id', verifyCompanyCoordinator, controller.getRacmAuditLogs);
router.get('/communication-matrix', verifyCompanyCoordinator, controller.getCommunicationMatrix);
router.post('/communication-matrix/common', verifyCompanyCoordinator, controller.addCommonCommunicationEmails);
router.post('/communication-matrix/specific', verifyCompanyCoordinator, controller.addBusinessProcessSpecificCommunicationEmails);
router.post('/communication-matrix/delete', verifyCompanyCoordinator, controller.deleteCommunicationMatrixEntries);

module.exports = router;
