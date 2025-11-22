const db = require('../config/db');

const getBankAccounts = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const accounts = await db.query('SELECT * FROM bank_accounts WHERE user_id = $1 ORDER BY account_name ASC', [userId]);
        res.json(accounts.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const getBankAccountById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(req.user.id, 10);
        const account = await db.query(
            'SELECT * FROM bank_accounts WHERE account_id = $1 AND user_id = $2',
            [id, userId]
        );
        if (account.rows.length === 0) {
            return res.status(404).json({ msg: 'Cuenta no encontrada o no autorizada.' });
        }
        res.json(account.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const createBankAccount = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { account_name, account_type, bank_name, account_number_masked, current_balance, gl_account_id } = req.body;
        const newAccount = await db.query(
            'INSERT INTO bank_accounts (user_id, account_name, account_type, bank_name, account_number_masked, current_balance, gl_account_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [userId, account_name, account_type, bank_name, account_number_masked, current_balance, gl_account_id]
        );
        res.status(201).json(newAccount.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const updateBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(req.user.id, 10);
        const { account_name, account_type, bank_name, account_number_masked, current_balance, gl_account_id } = req.body;
        const updatedAccount = await db.query(
            'UPDATE bank_accounts SET account_name = $1, account_type = $2, bank_name = $3, account_number_masked = $4, current_balance = $5, gl_account_id = $6 WHERE account_id = $7 AND user_id = $8 RETURNING *',
            [account_name, account_type, bank_name, account_number_masked, current_balance, gl_account_id, id, userId]
        );
        if (updatedAccount.rows.length === 0) return res.status(404).json({ msg: 'Cuenta no encontrada.' });
        res.json(updatedAccount.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const deleteBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(req.user.id, 10);
        await db.query('DELETE FROM bank_accounts WHERE account_id = $1 AND user_id = $2', [id, userId]);
        res.json({ msg: 'Cuenta bancaria eliminada.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

module.exports = { getBankAccounts, getBankAccountById, createBankAccount, updateBankAccount, deleteBankAccount };