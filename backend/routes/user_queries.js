const express = require('express');
const controller = require('../controllers/user_query');
const { verifyAuthenticatedUser } = require('../modules/auth/auth.middleware');

const router = express.Router();

router.post('/', verifyAuthenticatedUser, controller.submitUserQuery);

module.exports = router;
