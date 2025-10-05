// server/routes/bills.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
    getBills,
    createBill,
    getBillById,
    updateBill,
    deleteBill
} = require('../controllers/billController');

// Protegemos todas las rutas con el middleware de autenticación
router.use(authMiddleware);

router.route('/')
    .get(getBills)
    .post(createBill);

router.route('/:id')
    .get(getBillById)
    .put(updateBill)
    .delete(deleteBill);

module.exports = router;