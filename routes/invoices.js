// server/routes/invoices.js

const express = require('express');
const router = express.Router();

// Importamos nuestro "guardián" para proteger las rutas.
const authMiddleware = require('../middleware/authMiddleware');

// Importamos las funciones lógicas que crearemos en el controlador.
const {
    createInvoice,
    getInvoices,
    getInvoiceById,
    updateInvoice,
    deleteInvoice,
    downloadInvoicePdf,
    addPaymentToInvoice,
    updateInvoiceStatus,
} = require('../controllers/invoiceController');

// Le decimos al router que use el middleware de autenticación para TODAS las rutas definidas en este archivo.
// Nadie podrá acceder a /api/invoices/* sin un token válido.
router.use(authMiddleware);

// Ruta para obtener todas las facturas y crear una nueva.
router.route('/')
    .get(getInvoices)
    .post(createInvoice);

// Nueva ruta para registrar un pago en una factura
router.post('/:id/payments', addPaymentToInvoice);

// Nueva ruta para actualizar solo el estado
router.put('/:id/status', updateInvoiceStatus);

// Nueva ruta para generar el PDF
router.get('/:id/pdf', downloadInvoicePdf);

// Ruta para manejar una factura específica por su ID.
router.route('/:id')
    .get(getInvoiceById)
    .put(updateInvoice)
    .delete(deleteInvoice);
// Nueva ruta para generar el PDF

module.exports = router;