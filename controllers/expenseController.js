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
    try {
        const userId = req.user.id;
        // Añadimos vendor_id
        const { description, amount, category, expense_date, vendor_id } = req.body;

        const newExpense = await db.query(
            'INSERT INTO expenses (user_id, description, amount, category, expense_date, vendor_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [userId, description, amount, category, expense_date, vendor_id || null]
        );
        res.status(201).json(newExpense.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};
// @desc    Actualizar un gasto (con suplidor opcional)
const updateExpense = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { description, amount, category, expense_date, vendor_id } = req.body;

        const updatedExpense = await db.query(
            'UPDATE expenses SET description = $1, amount = $2, category = $3, expense_date = $4, vendor_id = $5 WHERE expense_id = $6 AND user_id = $7 RETURNING *',
            [description, amount, category, expense_date, vendor_id || null, id, userId]
        );

        if (updatedExpense.rows.length === 0) {
            return res.status(404).json({ msg: 'Gasto no encontrado o no autorizado' });
        }
        res.json(updatedExpense.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
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