// server/routes/accounts.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
    getAccounts,
    createAccount,
    updateAccount,
    deleteAccount
} = require('../controllers/accountController');

router.use(authMiddleware);

router.route('/')
    .get(getAccounts)
    .post(createAccount);

router.route('/:id')
    .put(updateAccount)
    .delete(deleteAccount);

module.exports = router;