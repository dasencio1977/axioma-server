const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getBankAccounts,
    getBankAccountById,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount
} = require('../controllers/bankAccountController');

router.use(authMiddleware);

router.route('/')
    .get(getBankAccounts)
    .post(createBankAccount);

router.route('/:id')
    .get(getBankAccountById)
    .put(updateBankAccount)
    .delete(deleteBankAccount);

module.exports = router;