// server/routes/reconciliation.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getUnmatchedPayments, matchPayment, reconcileAsDeposit } = require('../controllers/reconciliationController');

router.use(authMiddleware);
router.get('/unmatched-payments', getUnmatchedPayments);
router.post('/match-payment', matchPayment);
router.post('/reconcile-as-deposit', reconcileAsDeposit);

module.exports = router;