const express = require('express');
const controller = require('../controllers/controls_library');
const { verifyAuthenticatedUser } = require('../modules/auth/auth.middleware');

const router = express.Router();

router.get('/suggestions', verifyAuthenticatedUser, controller.getControlsLibrarySuggestions);

module.exports = router;
