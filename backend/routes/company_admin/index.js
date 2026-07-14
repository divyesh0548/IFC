const express = require('express');
const controller = require('../../controllers/company_admin/companyAdmin');
const { verifyCompanyAdmin } = require('../../modules/auth/auth.middleware');

const router = express.Router();

router.get('/home-stats', verifyCompanyAdmin, controller.getHomeStats);
router.get('/ifc-report', verifyCompanyAdmin, controller.getIfcReport);
router.get('/users', verifyCompanyAdmin, controller.getUsers);
router.post('/users/bulk', verifyCompanyAdmin, controller.createUsersBulk);
router.post('/users/delete', verifyCompanyAdmin, controller.deleteUsers);
router.get('/racm-dashboard/filters', verifyCompanyAdmin, controller.getDashboardFilters);
router.get('/racm-dashboard/racms', verifyCompanyAdmin, controller.getDashboardRacms);
router.get('/racm-audit-logs/:form_id', verifyCompanyAdmin, controller.getRacmAuditLogs);
router.get('/control-form-history/:form_id', verifyCompanyAdmin, controller.getControlFormHistory);
router.get('/unit-management', verifyCompanyAdmin, controller.getUnitManagement);
router.post('/unit-management/units', verifyCompanyAdmin, controller.createCompanyUnit);
router.patch('/unit-management/units/:unit_id', verifyCompanyAdmin, controller.updateCompanyUnit);
router.patch('/unit-management/units/:unit_id/assignment', verifyCompanyAdmin, controller.updateUnitAssignment);
router.post('/unit-management/coordinators', verifyCompanyAdmin, controller.createCoordinator);
router.patch('/unit-management/coordinators/units', verifyCompanyAdmin, controller.updateCoordinatorUnits);
router.post('/unit-management/approvers', verifyCompanyAdmin, controller.createApprover);
router.post('/unit-management/approver-assignments', verifyCompanyAdmin, controller.assignApprover);
router.post('/users', verifyCompanyAdmin, controller.createUser);
router.patch('/users/units', verifyCompanyAdmin, controller.updateUserUnits);
router.post('/business-processes', verifyCompanyAdmin, controller.createCompanyBusinessProcess);

module.exports = router;
