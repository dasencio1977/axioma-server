const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
    getVendors,
    createVendor,
    updateVendor,
    deleteVendor
} = require('../controllers/vendorController');

router.use(authMiddleware);

router.route('/')
    .get(getVendors)
    .post(createVendor);

router.route('/:id')
    .put(updateVendor)
    .delete(deleteVendor);

module.exports = router;