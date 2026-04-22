const express = require('express');
const controller = require('../../controllers/siteadmin/siteadmin');
const { verifySiteadminAuth } = require('../../modules/auth/auth.middleware');

const router = express.Router();

router.get('/companies', verifySiteadminAuth, controller.getCompanies);
router.get('/companies/:company_identifier', verifySiteadminAuth, controller.getCompanyByIdentifier);
router.post('/companies/create', verifySiteadminAuth, controller.createCompany);
router.delete('/companies/:company_identifier', verifySiteadminAuth, controller.deleteCompany);

module.exports = router;
