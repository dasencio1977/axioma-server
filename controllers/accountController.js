const db = require('../config/db');

const getAccounts = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);

        if (req.query.all === 'true') {
            const allAccounts = await db.query('SELECT * FROM accounts WHERE user_id = $1 ORDER BY account_number ASC', [userId]);
            return res.json(allAccounts.rows);
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [dataResult, countResult] = await Promise.all([
            db.query('SELECT * FROM accounts WHERE user_id = $1 ORDER BY account_number ASC LIMIT $2 OFFSET $3', [userId, limit, offset]),
            db.query('SELECT COUNT(*) FROM accounts WHERE user_id = $1', [userId])
        ]);

        const accounts = dataResult.rows;
        const totalPages = Math.ceil(parseInt(countResult.rows[0].count, 10) / limit);

        res.json({ accounts, totalPages, currentPage: page });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const createAccount = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { account_number, account_name, account_type, account_subtype, description, is_active } = req.body;

        const newAccount = await db.query(
            `INSERT INTO accounts (user_id, account_number, account_name, account_type, account_subtype, description, is_active) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [userId, account_number, account_name, account_type, account_subtype, description, is_active]
        );
        res.status(201).json(newAccount.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err.code === '23505') {
            return res.status(400).json({ msg: 'El número de cuenta ya existe.' });
        }
        res.status(500).send('Error en el servidor');
    }
};

const updateAccount = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { id } = req.params;
        const { account_number, account_name, account_type, account_subtype, description, is_active } = req.body;

        const updatedAccount = await db.query(
            `UPDATE accounts SET account_number = $1, account_name = $2, account_type = $3, account_subtype = $4, description = $5, is_active = $6
             WHERE account_id = $7 AND user_id = $8 RETURNING *`,
            [account_number, account_name, account_type, account_subtype, description, is_active, id, userId]
        );

        if (updatedAccount.rows.length === 0) {
            return res.status(404).json({ msg: 'Cuenta no encontrada o no autorizada' });
        }
        res.json(updatedAccount.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err.code === '23505') {
            return res.status(400).json({ msg: 'El número de cuenta ya existe.' });
        }
        res.status(500).send('Error en el servidor');
    }
};

const deleteAccount = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { id } = req.params;
        const deletedAccount = await db.query('DELETE FROM accounts WHERE account_id = $1 AND user_id = $2 RETURNING *', [id, userId]);
        if (deletedAccount.rows.length === 0) {
            return res.status(404).json({ msg: 'Cuenta no encontrada o no autorizada' });
        }
        res.json({ msg: 'Cuenta eliminada correctamente' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

module.exports = {
    getAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
};