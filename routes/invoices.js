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
    downloadInvoicePdf,
    getNextInvoiceNumber
} = require('../controllers/invoiceController');

router.use(authMiddleware);

router.route('/')
    .get(getInvoices)
    .post(createInvoice);

router.get('/next-number', getNextInvoiceNumber);

router.post('/:id/payments', addPaymentToInvoice);
router.put('/:id/status', updateInvoiceStatus);
router.get('/:id/pdf', downloadInvoicePdf);

router.route('/:id')
    .get(getInvoiceById)
    .put(updateInvoice)
    .delete(deleteInvoice);

module.exports = router;