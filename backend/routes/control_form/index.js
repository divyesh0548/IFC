const express = require('express');
const controller = require('../../controllers/control_form/control_form');
const { verifyUserAuth } = require('../../modules/auth/auth.middleware');

const router = express.Router();

router.get('/test-route', controller.testRoute);
router.get('/control-number-preview', controller.verifyAuth, controller.getControlNumberPreview);
router.get('/column-mapping-config', controller.verifyAuth, controller.getColumnMappingConfig);
router.get('/control-frequency-options', controller.verifyAuth, controller.getControlFrequencyOptions);
router.post('/bulk-import-rows', controller.verifyAuth, controller.bulkImportRows);
router.get('/', controller.verifyAuth, controller.listControlForms);
router.get('/assignment-eligible', controller.verifyAuth, controller.listAssignmentEligible);
router.get('/stats', controller.verifyAuth, controller.getControlFormsStats);
router.get('/download-document', controller.verifyAuth, controller.downloadDocument);
router.get('/:form_id', controller.verifyAuth, controller.getControlFormById);
router.put('/:form_id', controller.verifyAuth, controller.updateControlForm);
router.post('/:form_id/deficiency-response', controller.verifyAuth, controller.submitDeficiencyResponse);
router.post('/:form_id/process-owner-declaration', controller.verifyAuth, controller.declareNoFurtherSubmission);
router.post('/:form_id/deficiency-response/upload-attachments', controller.verifyAuth, controller.handleDeficiencyResponseUpload, controller.uploadDeficiencyResponseAttachments);
router.post('/:form_id/request-change', controller.verifyAuth, controller.requestChange);
router.get('/:form_id/change-request/active', controller.verifyAuth, controller.getActiveChangeRequest);
router.get('/:form_id/change-request/history', controller.verifyAuth, controller.getChangeRequestHistory);
router.post('/:form_id/change-request/:request_id/review', controller.verifyAuth, controller.reviewChangeRequest);
router.post('/bulk-set-active', controller.verifyAuth, controller.bulkSetActive);
router.post('/bulk-set-due-date', controller.verifyAuth, controller.bulkSetDueDate);
router.post('/', controller.verifyAuth, controller.createControlForm);
router.post('/replicate', controller.verifyAuth, controller.replicateControlForm);
router.delete('/:form_id', controller.verifyAuth, controller.deleteControlForm);
router.get('/:form_id/approver-status', verifyUserAuth, controller.getApproverStatus);
router.post('/:form_id/self-assign', controller.verifyAuth, controller.selfAssignRacm);
router.post('/:form_id/upload-document', controller.verifyAuth, controller.handleUserDocumentUpload, controller.uploadUserDocument);
router.get('/:form_id/check-sampling-exists', controller.verifyAuth, controller.checkSamplingExists);
router.delete('/:form_id/user-doc', controller.verifyAuth, controller.deleteUserDocument);
router.delete('/:form_id/sample-docs/:sample_doc_id', controller.verifyAuth, controller.deleteSampleDocument);
router.post('/:form_id/upload-sampling-excel', controller.verifyAuth, controller.handleSampleDocumentUpload, controller.uploadSamplingExcel);

module.exports = router;
