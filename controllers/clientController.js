const db = require('../config/db');

const getClients = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);

        if (req.query.all === 'true') {
            const allClients = await db.query('SELECT * FROM clients WHERE user_id = $1 ORDER BY client_name ASC', [userId]);
            return res.json(allClients.rows);
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [dataResult, countResult] = await Promise.all([
            db.query(
                'SELECT * FROM clients WHERE user_id = $1 ORDER BY client_name ASC LIMIT $2 OFFSET $3',
                [userId, limit, offset]
            ),
            db.query('SELECT COUNT(*) FROM clients WHERE user_id = $1', [userId])
        ]);

        const clients = dataResult.rows;
        const totalClients = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalClients / limit);

        res.json({
            clients,
            totalPages,
            currentPage: page,
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const createClient = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { client_name, contact_email, contact_phone, address } = req.body;
        const newClient = await db.query(
            'INSERT INTO clients (user_id, client_name, contact_email, contact_phone, address) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, client_name, contact_email, contact_phone, address]
        );
        res.status(201).json(newClient.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const updateClient = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { id } = req.params;
        const { client_name, contact_email, contact_phone, address } = req.body;

        const updatedClient = await db.query(
            'UPDATE clients SET client_name = $1, contact_email = $2, contact_phone = $3, address = $4 WHERE client_id = $5 AND user_id = $6 RETURNING *',
            [client_name, contact_email, contact_phone, address, id, userId]
        );

        if (updatedClient.rows.length === 0) {
            return res.status(404).json({ msg: 'Cliente no encontrado o no autorizado' });
        }
        res.json(updatedClient.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const deleteClient = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { id } = req.params;
        const deletedClient = await db.query(
            'DELETE FROM clients WHERE client_id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );
        if (deletedClient.rows.length === 0) {
            return res.status(404).json({ msg: 'Cliente no encontrado o no autorizado' });
        }
        res.json({ msg: 'Cliente eliminado correctamente' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

module.exports = {
    getClients,
    createClient,
    updateClient,
    deleteClient,
};