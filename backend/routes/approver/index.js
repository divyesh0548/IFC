const { rejectFailedRacmMutation } = require('../../utils/racm_failure');
const express = require('express');
const router = express.Router();
const controller = require('../../controllers/approver/approver');
const { verifyApproverAuth } = require('../../modules/auth/auth.middleware');

router.get('/home-stats', verifyApproverAuth, controller.getHomeStats);
router.get('/dashboard', verifyApproverAuth, controller.getDashboard);
router.get('/pending-approvals', verifyApproverAuth, controller.getPendingApprovals);
router.post('/approve-form/:form_id', verifyApproverAuth, rejectFailedRacmMutation, controller.approveForm);
router.post('/deficiency-response/:form_id/review', verifyApproverAuth, rejectFailedRacmMutation, controller.reviewDeficiencyResponse);
router.post('/change-approval-decision/:form_id', verifyApproverAuth, rejectFailedRacmMutation, controller.changeApprovalDecision);
router.get('/control-forms', verifyApproverAuth, controller.getControlForms);
router.get('/control-forms/:form_id/access', verifyApproverAuth, controller.checkControlFormAccess);
router.get('/control-forms/:form_id', verifyApproverAuth, controller.getControlFormById);
router.get('/control-form-history/:form_id', verifyApproverAuth, controller.getControlFormHistory);
router.get('/racm-audit-logs/:form_id', verifyApproverAuth, controller.getRacmAuditLogs);
router.get('/ifc-report/export', verifyApproverAuth, controller.exportIfcReportRacms);
router.get('/ifc-report/export-units', verifyApproverAuth, controller.getIfcReportExportUnits);

module.exports = router;
