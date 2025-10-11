// server/controllers/expenseController.js

const db = require('../config/db');

// @desc    Obtener todos los gastos del usuario CON PAGINACIÓN
// @desc    Obtener gastos del usuario (con paginación Y nombre del suplidor)
const getExpenses = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        // Usamos LEFT JOIN para incluir el nombre del suplidor.
        // LEFT JOIN asegura que los gastos sin suplidor también aparezcan.
        const query = `
            SELECT e.*, v.name AS vendor_name
            FROM expenses e
            LEFT JOIN vendors v ON e.vendor_id = v.vendor_id
            WHERE e.user_id = $1
            ORDER BY e.expense_date DESC
            LIMIT $2 OFFSET $3;
        `;
        const [dataResult, countResult] = await Promise.all([
            db.query(query, [userId, limit, offset]),
            db.query('SELECT COUNT(*) FROM expenses WHERE user_id = $1', [userId])
        ]);

        const expenses = dataResult.rows;
        const totalPages = Math.ceil(parseInt(countResult.rows[0].count, 10) / limit);

        res.json({ expenses, totalPages, currentPage: page });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};
// @desc    Crear un nuevo gasto (con suplidor opcional)
const createExpense = async (req, res) => {
    const userId = parseInt(req.user.id, 10);
    const { description, amount, expense_account_id, expense_date, vendor_id } = req.body;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // 1. Obtener la cuenta de efectivo por defecto
        const profileRes = await client.query('SELECT default_cash_account FROM profiles WHERE user_id = $1', [userId]);
        if (!profileRes.rows[0]?.default_cash_account) {
            throw new Error('Por favor, configure su cuenta de Efectivo/Banco por defecto en la página de Configuración.');
        }
        const creditAccountId = profileRes.rows[0].default_cash_account;

        // 2. Crear el registro del gasto
        const newExpense = await client.query(
            'INSERT INTO expenses (user_id, description, amount, expense_account_id, expense_date, vendor_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [userId, description, amount, expense_account_id, expense_date, vendor_id || null]
        );

        // 3. Crear el asiento contable
        const entryDesc = `Gasto: ${description}`;
        const entryQuery = `INSERT INTO journal_entries (user_id, entry_date, description) VALUES ($1, $2, $3) RETURNING entry_id;`;
        const newEntry = await client.query(entryQuery, [userId, expense_date, entryDesc]);
        const entryId = newEntry.rows[0].entry_id;

        // Débito a la cuenta de gasto, Crédito a la cuenta de efectivo
        await client.query(`INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, 'Debito', $3);`, [entryId, expense_account_id, amount]);
        await client.query(`INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, 'Credito', $3);`, [entryId, creditAccountId, amount]);

        await client.query('COMMIT');
        res.status(201).json(newExpense.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message });
    } finally {
        client.release();
    }
};

// @desc    Actualizar un gasto (con suplidor opcional)
const updateExpense = async (req, res) => {
    const userId = parseInt(req.user.id, 10);
    const { id: expenseId } = req.params;
    const { description, amount, expense_account_id, expense_date, vendor_id } = req.body;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // 1. Antes de hacer cambios, obtenemos el ID del asiento contable antiguo (si existe) para borrarlo.
        // Asumimos que necesitamos una columna 'journal_entry_id' en la tabla 'expenses' para esta vinculación.
        // Si no la tienes, una alternativa es buscar por descripción y fecha, pero es menos preciso.
        // Por ahora, vamos a borrar el asiento vinculado al gasto (necesitamos añadir esa vinculación).

        // --- (Nota: Primero, necesitamos actualizar la tabla 'expenses' para vincularla al asiento) ---
        // ALTER TABLE expenses ADD COLUMN journal_entry_id INTEGER REFERENCES journal_entries(entry_id) ON DELETE SET NULL;

        const oldExpenseRes = await client.query('SELECT journal_entry_id FROM expenses WHERE expense_id = $1 AND user_id = $2', [expenseId, userId]);
        if (oldExpenseRes.rows.length > 0 && oldExpenseRes.rows[0].journal_entry_id) {
            await client.query('DELETE FROM journal_entries WHERE entry_id = $1', [oldExpenseRes.rows[0].journal_entry_id]);
        }

        // 2. Obtener la cuenta de efectivo por defecto (necesaria para el nuevo asiento)
        const profileRes = await client.query('SELECT default_cash_account FROM profiles WHERE user_id = $1', [userId]);
        if (!profileRes.rows[0]?.default_cash_account) {
            throw new Error('Por favor, configure su cuenta de Efectivo/Banco por defecto en la página de Configuración.');
        }
        const creditAccountId = profileRes.rows[0].default_cash_account;

        // 3. Crear el nuevo asiento contable con la información actualizada
        const entryDesc = `Gasto: ${description}`;
        const entryQuery = `INSERT INTO journal_entries (user_id, entry_date, description) VALUES ($1, $2, $3) RETURNING entry_id;`;
        const newEntry = await client.query(entryQuery, [userId, expense_date, entryDesc]);
        const newEntryId = newEntry.rows[0].entry_id;

        // Débito a la nueva cuenta de gasto, Crédito a la cuenta de efectivo
        await client.query(`INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, 'Debito', $3);`, [newEntryId, expense_account_id, amount]);
        await client.query(`INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, 'Credito', $3);`, [newEntryId, creditAccountId, amount]);

        // 4. Actualizar el registro del gasto con la nueva información y el ID del nuevo asiento
        const updatedExpense = await client.query(
            'UPDATE expenses SET description = $1, amount = $2, expense_account_id = $3, expense_date = $4, vendor_id = $5, journal_entry_id = $6 WHERE expense_id = $7 AND user_id = $8 RETURNING *',
            [description, amount, expense_account_id, expense_date, vendor_id || null, newEntryId, expenseId, userId]
        );

        if (updatedExpense.rows.length === 0) {
            throw new Error('Gasto no encontrado o no autorizado');
        }

        await client.query('COMMIT');
        res.json(updatedExpense.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message });
    } finally {
        client.release();
    }
};

// @desc    Eliminar un gasto
const deleteExpense = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params; // ID del gasto a eliminar

        const deletedExpense = await db.query(
            'DELETE FROM expenses WHERE expense_id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );

        if (deletedExpense.rows.length === 0) {
            return res.status(404).json({ msg: 'Gasto no encontrado o no autorizado' });
        }

        res.json({ msg: 'Gasto eliminado correctamente' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

module.exports = {
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
};