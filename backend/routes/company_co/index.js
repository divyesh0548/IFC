const express = require('express');
const controller = require('../../controllers/company_co/company_co');
const { verifyCompanyCoordinator } = require('../../modules/auth/auth.middleware');

const router = express.Router();

router.get('/home-stats', verifyCompanyCoordinator, controller.getHomeStats);
router.get('/dashboard/filters', verifyCompanyCoordinator, controller.getDashboardFilters);
router.get('/dashboard/summary', verifyCompanyCoordinator, controller.getDashboardSummary);
router.get('/dashboard/key-controls', verifyCompanyCoordinator, controller.getDashboardKeyControlStats);
router.get('/dashboard/nature-of-control', verifyCompanyCoordinator, controller.getDashboardNatureStats);
router.get('/dashboard/control-type', verifyCompanyCoordinator, controller.getDashboardControlTypeStats);
router.get('/dashboard/racms', verifyCompanyCoordinator, controller.getDashboardRacms);
router.get('/risk-analysis/availability', verifyCompanyCoordinator, controller.getRiskAnalysisAvailability);
router.get('/risk-analysis/control/:control_number', verifyCompanyCoordinator, controller.getRiskAnalysisByControl);
router.post('/risk-analysis/control/:control_number/generate', verifyCompanyCoordinator, controller.generateRiskAnalysisByControl);
router.get('/ai-insights/key-manual-summary/availability', verifyCompanyCoordinator, controller.getKeyManualAiInsightsAvailability);
router.get('/ai-insights/key-manual-summary', verifyCompanyCoordinator, controller.getKeyManualAiInsightsRun);
router.post('/ai-insights/key-manual-summary/generate', verifyCompanyCoordinator, controller.generateKeyManualAiInsightsRun);
router.delete('/ai-insights/key-manual-summary/:run_id', verifyCompanyCoordinator, controller.deleteKeyManualAiInsightsRun);
router.get('/racm-audit-logs/:form_id', verifyCompanyCoordinator, controller.getRacmAuditLogs);
router.get('/communication-matrix', verifyCompanyCoordinator, controller.getCommunicationMatrix);
router.post('/communication-matrix/common', verifyCompanyCoordinator, controller.addCommonCommunicationEmails);
router.post('/communication-matrix/specific', verifyCompanyCoordinator, controller.addBusinessProcessSpecificCommunicationEmails);
router.post('/communication-matrix/delete', verifyCompanyCoordinator, controller.deleteCommunicationMatrixEntries);
router.post('/business-processes', verifyCompanyCoordinator, controller.createCompanyBusinessProcess);

module.exports = router;
