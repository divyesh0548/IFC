const express = require('express');
const controller = require('../../controllers/siteadmin/siteadmin');
const userQueryController = require('../../controllers/user_query');
const { verifySiteadminAuth } = require('../../modules/auth/auth.middleware');

const router = express.Router();

router.get('/companies', verifySiteadminAuth, controller.getCompanies);
router.post('/business-processes', verifySiteadminAuth, controller.createBusinessProcessManagementEntry);
router.get('/auditors', verifySiteadminAuth, controller.getAuditors);
router.post('/auditors', verifySiteadminAuth, controller.createAuditor);
router.post('/companies/:company_identifier/company-admins', verifySiteadminAuth, controller.createCompanyAdmin);
router.get('/companies/:company_identifier', verifySiteadminAuth, controller.getCompanyByIdentifier);
router.post('/companies/create', verifySiteadminAuth, controller.createCompany);

router.get('/user-queries', verifySiteadminAuth, userQueryController.getUserQueries);
router.patch('/user-queries/:id/reviewed', verifySiteadminAuth, userQueryController.markUserQueryReviewed);

module.exports = router;
