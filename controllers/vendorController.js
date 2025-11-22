const db = require('../config/db');

const getVendors = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);

        if (req.query.all === 'true') {
            const allVendors = await db.query('SELECT vendor_id, name FROM vendors WHERE user_id = $1 ORDER BY name ASC', [userId]);
            return res.json(allVendors.rows);
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [dataResult, countResult] = await Promise.all([
            db.query('SELECT * FROM vendors WHERE user_id = $1 ORDER BY name ASC LIMIT $2 OFFSET $3', [userId, limit, offset]),
            db.query('SELECT COUNT(*) FROM vendors WHERE user_id = $1', [userId])
        ]);

        const vendors = dataResult.rows;
        const totalPages = Math.ceil(parseInt(countResult.rows[0].count, 10) / limit);

        res.json({ vendors, totalPages, currentPage: page });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const createVendor = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const {
            name, email, phone, ein, corporation_id, merchant_id,
            contact_first_name, contact_middle_initial, contact_last_name, contact_phone,
            physical_address_1, physical_address_2, physical_address_3, physical_city, physical_state, physical_country, physical_zip_code,
            is_postal_same_as_physical,
            postal_address_1, postal_address_2, postal_address_3, postal_city, postal_state, postal_country, postal_zip_code
        } = req.body;

        const newVendor = await db.query(
            `INSERT INTO vendors (user_id, name, email, phone, ein, corporation_id, merchant_id, contact_first_name, contact_middle_initial, contact_last_name, contact_phone, physical_address_1, physical_address_2, physical_address_3, physical_city, physical_state, physical_country, physical_zip_code, is_postal_same_as_physical, postal_address_1, postal_address_2, postal_address_3, postal_city, postal_state, postal_country, postal_zip_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26) RETURNING *`,
            [userId, name, email, phone, ein, corporation_id, merchant_id, contact_first_name, contact_middle_initial, contact_last_name, contact_phone, physical_address_1, physical_address_2, physical_address_3, physical_city, physical_state, physical_country, physical_zip_code, is_postal_same_as_physical, postal_address_1, postal_address_2, postal_address_3, postal_city, postal_state, postal_country, postal_zip_code]
        );
        res.status(201).json(newVendor.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const updateVendor = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { id } = req.params;
        const {
            name, email, phone, ein, corporation_id, merchant_id,
            contact_first_name, contact_middle_initial, contact_last_name, contact_phone,
            physical_address_1, physical_address_2, physical_address_3, physical_city, physical_state, physical_country, physical_zip_code,
            is_postal_same_as_physical,
            postal_address_1, postal_address_2, postal_address_3, postal_city, postal_state, postal_country, postal_zip_code
        } = req.body;

        const updatedVendor = await db.query(
            `UPDATE vendors SET name = $1, email = $2, phone = $3, ein = $4, corporation_id = $5, merchant_id = $6, contact_first_name = $7, contact_middle_initial = $8, contact_last_name = $9, contact_phone = $10, physical_address_1 = $11, physical_address_2 = $12, physical_address_3 = $13, physical_city = $14, physical_state = $15, physical_country = $16, physical_zip_code = $17, is_postal_same_as_physical = $18, postal_address_1 = $19, postal_address_2 = $20, postal_address_3 = $21, postal_city = $22, postal_state = $23, postal_country = $24, postal_zip_code = $25
             WHERE vendor_id = $26 AND user_id = $27 RETURNING *`,
            [name, email, phone, ein, corporation_id, merchant_id, contact_first_name, contact_middle_initial, contact_last_name, contact_phone, physical_address_1, physical_address_2, physical_address_3, physical_city, physical_state, physical_country, physical_zip_code, is_postal_same_as_physical, postal_address_1, postal_address_2, postal_address_3, postal_city, postal_state, postal_country, postal_zip_code, id, userId]
        );

        if (updatedVendor.rows.length === 0) {
            return res.status(404).json({ msg: 'Suplidor no encontrado o no autorizado' });
        }
        res.json(updatedVendor.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const deleteVendor = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { id } = req.params;
        const deletedVendor = await db.query('DELETE FROM vendors WHERE vendor_id = $1 AND user_id = $2 RETURNING *', [id, userId]);
        if (deletedVendor.rows.length === 0) {
            return res.status(404).json({ msg: 'Suplidor no encontrado o no autorizado' });
        }
        res.json({ msg: 'Suplidor eliminado correctamente' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

module.exports = {
    getVendors,
    createVendor,
    updateVendor,
    deleteVendor,
};