const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
    createInvoice,
    updateInvoice,
    getInvoices,
    getInvoiceById,
    deleteInvoice,
    addPaymentToInvoice,
    updateInvoiceStatus,
<<<<<<< HEAD
    downloadInvoicePdf,
    getNextInvoiceNumber
=======
    getNextInvoiceNumber,
>>>>>>> 73caa98416f2e1c2d5ca1d2daec3e98380901cf1
} = require('../controllers/invoiceController');

router.use(authMiddleware);

router.route('/')
    .get(getInvoices)
    .post(createInvoice);

router.get('/next-number', getNextInvoiceNumber);

router.post('/:id/payments', addPaymentToInvoice);
router.put('/:id/status', updateInvoiceStatus);
router.get('/:id/pdf', downloadInvoicePdf);

<<<<<<< HEAD
=======
// Ruta para el siguiente número de factura (debe ir antes de /:id)
router.get('/next-number', getNextInvoiceNumber);

// Ruta para manejar una factura específica por su ID.
>>>>>>> 73caa98416f2e1c2d5ca1d2daec3e98380901cf1
router.route('/:id')
    .get(getInvoiceById)
    .put(updateInvoice)
    .delete(deleteInvoice);

module.exports = router;