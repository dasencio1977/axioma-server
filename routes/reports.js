const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// LA CORRECCIÓN: Nos aseguramos de importar TODAS las funciones que vamos a usar.
const {
    getProfitLossReport,
    getTrialBalance,
    getBalanceSheet,
    getCashFlowStatement,
    downloadPlReportPdf,
    downloadTrialBalancePdf,
    downloadBsReportPdf,
    downloadCashFlowPdf,
    getGeneralLedger,
} = require('../controllers/reportsController');

// --- Rutas para obtener los datos de los reportes (JSON) ---
router.post('/profit-loss', authMiddleware, getProfitLossReport);
router.post('/trial-balance', authMiddleware, getTrialBalance);
router.post('/balance-sheet', authMiddleware, getBalanceSheet);
router.post('/cash-flow', authMiddleware, getCashFlowStatement);
router.post('/general-ledger', authMiddleware, getGeneralLedger);

// --- Rutas para descargar los PDFs de los reportes ---
router.post('/profit-loss/pdf', authMiddleware, downloadPlReportPdf);
router.post('/trial-balance/pdf', authMiddleware, downloadTrialBalancePdf);
router.post('/balance-sheet/pdf', authMiddleware, downloadBsReportPdf);
router.post('/cash-flow/pdf', authMiddleware, downloadCashFlowPdf);

module.exports = router;