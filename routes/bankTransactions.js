const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getTransactionsForAccount,
    createTransactionForAccount,
    categorizeTransaction
} = require('../controllers/bankTransactionController');

router.use(authMiddleware);

// La ruta completa y explícita es: /api/bank-transactions/by-account/:accountId
router.route('/by-account/:accountId')
    .get(getTransactionsForAccount)
    .post(createTransactionForAccount);


router.route('/:transactionId/categorize')
    .post(categorizeTransaction);

module.exports = router;