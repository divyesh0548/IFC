const express = require('express');
const controller = require('../../controllers/siteadmin/siteadmin');
const { verifySiteadminAuth } = require('../../modules/auth/auth.middleware');

const router = express.Router();

router.get('/companies', verifySiteadminAuth, controller.getCompanies);
router.post('/business-processes', verifySiteadminAuth, controller.createBusinessProcessManagementEntry);
router.get('/auditors', verifySiteadminAuth, controller.getAuditors);
router.post('/auditors', verifySiteadminAuth, controller.createAuditor);
router.get('/companies/:company_identifier', verifySiteadminAuth, controller.getCompanyByIdentifier);
router.get('/companies/:company_identifier/unit-management', verifySiteadminAuth, controller.getCompanyUnitManagement);
router.patch('/companies/:company_identifier/unit-management/units/:unit_id/assignment', verifySiteadminAuth, controller.updateCompanyUnitAssignment);
router.post('/companies/:company_identifier/unit-management/coordinators', verifySiteadminAuth, controller.createCompanyCoordinator);
router.post('/companies/:company_identifier/unit-management/approvers', verifySiteadminAuth, controller.createCompanyApprover);
router.post('/companies/create', verifySiteadminAuth, controller.createCompany);
router.delete('/companies/:company_identifier', verifySiteadminAuth, controller.deleteCompany);

module.exports = router;
