// server/routes/vendors.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
    getVendors,
    createVendor,
    updateVendor,
    deleteVendor
} = require('../controllers/vendorController');

// Aplicamos el middleware a todas las rutas.
router.use(authMiddleware);

router.route('/')
    .get(getVendors)
    .post(createVendor);

router.route('/:id')
    .put(updateVendor)
    .delete(deleteVendor);

module.exports = router;