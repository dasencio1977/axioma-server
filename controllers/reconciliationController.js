const db = require('../config/db');

// @desc    Obtener pagos de clientes no conciliados
const getUnmatchedPayments = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT p.payment_id, p.amount_paid, p.payment_date, i.invoice_number, c.client_name
            FROM payments p
            JOIN invoices i ON p.invoice_id = i.invoice_id
            JOIN clients c ON i.client_id = c.client_id
            WHERE p.user_id = $1 AND p.is_reconciled = false
            ORDER BY p.payment_date DESC;
        `;
        const result = await db.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

// @desc    Vincular una transacción bancaria a un pago de cliente
const matchPayment = async (req, res) => {
    const userId = req.user.id;
    const { bankTransactionId, paymentId } = req.body;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const txRes = await client.query('SELECT amount FROM bank_transactions WHERE transaction_id = $1 AND user_id = $2', [bankTransactionId, userId]);
        const paymentRes = await client.query('SELECT amount_paid FROM payments WHERE payment_id = $1 AND user_id = $2', [paymentId, userId]);
        if (txRes.rows.length === 0 || paymentRes.rows.length === 0) {
            throw new Error('La transacción o el pago no se encontraron.');
        }
        if (parseFloat(txRes.rows[0].amount) !== parseFloat(paymentRes.rows[0].amount_paid)) {
            throw new Error('Los montos no coinciden. No se puede vincular.');
        }
        await client.query('UPDATE bank_transactions SET is_reconciled = true, linked_payment_id = $1 WHERE transaction_id = $2', [paymentId, bankTransactionId]);
        await client.query('UPDATE payments SET is_reconciled = true WHERE payment_id = $1', [paymentId]);
        await client.query('COMMIT');
        res.json({ msg: 'Transacción vinculada y conciliada exitosamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message || 'Error al vincular la transacción.' });
    } finally {
        client.release();
    }
};

// @desc    Conciliar un depósito bancario como un asiento contable
const reconcileAsDeposit = async (req, res) => {
    const userId = req.user.id;
    const { bankTransactionId, creditAccountId, description } = req.body;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const txRes = await client.query('SELECT * FROM bank_transactions WHERE transaction_id = $1 AND user_id = $2', [bankTransactionId, userId]);
        if (txRes.rows.length === 0) throw new Error('Transacción bancaria no encontrada.');
        const bankTx = txRes.rows[0];

        const bankAccRes = await client.query('SELECT gl_account_id FROM bank_accounts WHERE account_id = $1', [bankTx.account_id]);
        if (!bankAccRes.rows[0]?.gl_account_id) throw new Error('La cuenta bancaria no tiene una cuenta contable vinculada.');
        const debitAccountId = bankAccRes.rows[0].gl_account_id;

        const entryRes = await client.query('INSERT INTO journal_entries (user_id, entry_date, description) VALUES ($1, $2, $3) RETURNING entry_id', [userId, bankTx.transaction_date, description]);
        const entryId = entryRes.rows[0].entry_id;

        await client.query('INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, \'Debito\', $3)', [entryId, debitAccountId, bankTx.amount]);
        await client.query('INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, \'Credito\', $3)', [entryId, creditAccountId, bankTx.amount]);

        await client.query('UPDATE bank_transactions SET is_reconciled = true WHERE transaction_id = $1', [bankTransactionId]);

        await client.query('COMMIT');
        res.json({ msg: 'Depósito categorizado y conciliado exitosamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message });
    } finally {
        client.release();
    }
};

// LA CORRECCIÓN: Asegurarse de que la nueva función esté en la lista de exportación.
module.exports = {
    getUnmatchedPayments,
    matchPayment,
    reconcileAsDeposit
};