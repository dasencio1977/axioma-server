const db = require('../config/db');

// @desc    Obtener todos los clientes del usuario CON PAGINACIÓN
const getClients = async (req, res) => {
    try {
        const userId = req.user.id; // Obtenido del middleware

        // 1. Obtenemos los parámetros 'page' y 'limit' de la URL (?page=1&limit=10)
        // Les damos un valor por defecto si no se especifican.
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;

        // 2. Calculamos el 'OFFSET', que es cuántos registros saltar.
        const offset = (page - 1) * limit;

        // 3. Hacemos dos consultas en paralelo para ser eficientes.
        const [dataResult, countResult] = await Promise.all([
            // Consulta para obtener solo la página de clientes que queremos.
            db.query(
                'SELECT * FROM clients WHERE user_id = $1 ORDER BY client_name ASC LIMIT $2 OFFSET $3',
                [userId, limit, offset]
            ),
            // Consulta para obtener el NÚMERO TOTAL de clientes del usuario.
            db.query('SELECT COUNT(*) FROM clients WHERE user_id = $1', [userId])
        ]);

        // 4. Extraemos los resultados.
        const clients = dataResult.rows;
        const totalClients = parseInt(countResult.rows[0].count, 10);

        // 5. Calculamos el total de páginas.
        const totalPages = Math.ceil(totalClients / limit);

        // 6. Enviamos una respuesta más completa, incluyendo los datos y la información de paginación.
        res.json({
            clients,
            totalPages,
            currentPage: page,
            totalClients
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

// @desc    Crear un nuevo cliente
const createClient = async (req, res) => {
    try {
        const userId = req.user.id;
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

// @desc    Actualizar un cliente
const updateClient = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params; // ID del cliente a actualizar
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

// @desc    Eliminar un cliente
const deleteClient = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params; // ID del cliente a eliminar

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