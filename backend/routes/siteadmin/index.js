const express = require('express');
const controller = require('../../controllers/siteadmin/siteadmin');
const controlsLibraryController = require('../../controllers/siteadmin/controls_library');
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

router.get(
  '/controls-library/template',
  verifySiteadminAuth,
  controlsLibraryController.downloadControlsLibraryTemplate
);
router.get(
  '/controls-library/summary',
  verifySiteadminAuth,
  controlsLibraryController.getControlsLibrarySummary
);
router.get(
  '/controls-library/sub-processes',
  verifySiteadminAuth,
  controlsLibraryController.listControlsLibrarySubProcesses
);
router.get(
  '/controls-library',
  verifySiteadminAuth,
  controlsLibraryController.listControlsLibrary
);
router.get(
  '/controls-library/:id',
  verifySiteadminAuth,
  controlsLibraryController.getControlsLibraryById
);
router.put(
  '/controls-library/:id',
  verifySiteadminAuth,
  controlsLibraryController.updateControlsLibrary
);
router.post(
  '/controls-library/upload',
  verifySiteadminAuth,
  controlsLibraryController.handleControlsLibraryUpload,
  controlsLibraryController.uploadControlsLibrary
);

router.get('/user-queries', verifySiteadminAuth, userQueryController.getUserQueries);
router.patch('/user-queries/:id/reviewed', verifySiteadminAuth, userQueryController.markUserQueryReviewed);

module.exports = router;
