const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getProfile, upsertProfile } = require('../controllers/profileController');

router.use(authMiddleware);

router.route('/')
    .get(getProfile)
    .put(upsertProfile);

module.exports = router;