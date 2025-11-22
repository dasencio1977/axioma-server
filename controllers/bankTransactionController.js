const db = require('../config/db');

const getTransactionsForAccount = async (req, res) => {
    try {
        const accountId = parseInt(req.params.accountId, 10);
        const userId = parseInt(req.user.id, 10);
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        if (isNaN(accountId)) {
            return res.status(400).json({ msg: 'El ID de la cuenta no es válido.' });
        }

        const accountCheck = await db.query('SELECT user_id FROM bank_accounts WHERE account_id = $1', [accountId]);
        if (accountCheck.rows.length === 0 || accountCheck.rows[0].user_id !== userId) {
            return res.status(404).json({ msg: 'Cuenta bancaria no encontrada o no autorizada.' });
        }

        const [dataResult, countResult] = await Promise.all([
            db.query('SELECT * FROM bank_transactions WHERE account_id = $1 ORDER BY transaction_date DESC, transaction_id DESC LIMIT $2 OFFSET $3', [accountId, limit, offset]),
            db.query('SELECT COUNT(*) FROM bank_transactions WHERE account_id = $1', [accountId])
        ]);

        const transactions = dataResult.rows;
        const totalPages = Math.ceil(parseInt(countResult.rows[0].count, 10) / limit);

        res.json({ transactions, totalPages, currentPage: page });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const createTransactionForAccount = async (req, res) => {
    const accountId = parseInt(req.params.accountId, 10);
    const userId = parseInt(req.user.id, 10);
    const { transaction_date, description, amount } = req.body;
    const client = await db.connect();
    try {
        if (isNaN(accountId)) {
            throw new Error('El ID de la cuenta bancaria no es válido.');
        }
        await client.query('BEGIN');
        const accountCheck = await client.query('SELECT user_id FROM bank_accounts WHERE account_id = $1', [accountId]);
        if (accountCheck.rows.length === 0 || accountCheck.rows[0].user_id !== userId) {
            throw new Error('Cuenta bancaria no encontrada o no autorizada.');
        }
        const newTransaction = await client.query(
            'INSERT INTO bank_transactions (user_id, account_id, transaction_date, description, amount) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, accountId, transaction_date, description, amount]
        );
        await client.query(
            'UPDATE bank_accounts SET current_balance = current_balance + $1 WHERE account_id = $2',
            [amount, accountId]
        );
        await client.query('COMMIT');
        res.status(201).json(newTransaction.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message || 'Error al crear la transacción.' });
    } finally {
        client.release();
    }
};

const categorizeTransaction = async (req, res) => {
    const { transactionId } = req.params;
    const userId = parseInt(req.user.id, 10);
    const { category, description, vendor_id } = req.body;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const txRes = await client.query('SELECT * FROM bank_transactions WHERE transaction_id = $1 AND user_id = $2', [transactionId, userId]);
        if (txRes.rows.length === 0) throw new Error('Transacción bancaria no encontrada.');
        const bankTx = txRes.rows[0];

        const expenseRes = await client.query(
            `INSERT INTO expenses (user_id, description, amount, category, expense_date, vendor_id) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING expense_id`,
            [userId, description, Math.abs(parseFloat(bankTx.amount)), category, bankTx.transaction_date, vendor_id || null]
        );
        const newExpenseId = expenseRes.rows[0].expense_id;

        await client.query(
            'UPDATE bank_transactions SET is_reconciled = true, linked_expense_id = $1 WHERE transaction_id = $2',
            [newExpenseId, transactionId]
        );
        await client.query('COMMIT');
        res.json({ msg: 'Transacción categorizada y conciliada exitosamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message || 'Error al conciliar la transacción.' });
    } finally {
        client.release();
    }
};

module.exports = {
    getTransactionsForAccount,
    createTransactionForAccount,
    categorizeTransaction,
};