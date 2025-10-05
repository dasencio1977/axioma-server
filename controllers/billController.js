// server/controllers/billController.js

const db = require('../config/db');

// @desc    Obtener facturas por pagar (con paginación)
const getBills = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const query = `
            SELECT b.*, v.name AS vendor_name
            FROM bills b
            LEFT JOIN vendors v ON b.vendor_id = v.vendor_id
            WHERE b.user_id = $1
            ORDER BY b.due_date DESC
            LIMIT $2 OFFSET $3;
        `;

        const [dataResult, countResult] = await Promise.all([
            db.query(query, [userId, limit, offset]),
            db.query('SELECT COUNT(*) FROM bills WHERE user_id = $1', [userId])
        ]);

        const bills = dataResult.rows;
        const totalPages = Math.ceil(parseInt(countResult.rows[0].count, 10) / limit);

        res.json({ bills, totalPages, currentPage: page });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

// @desc    Obtener una factura por pagar por su ID
const getBillById = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const billQuery = `
            SELECT b.*, v.name AS vendor_name
            FROM bills b
            LEFT JOIN vendors v ON b.vendor_id = v.vendor_id
            WHERE b.bill_id = $1 AND b.user_id = $2;
        `;
        const billDetails = await db.query(billQuery, [id, userId]);
        if (billDetails.rows.length === 0) {
            return res.status(404).json({ msg: 'Factura por pagar no encontrada.' });
        }

        const itemsResult = await db.query('SELECT * FROM bill_items WHERE bill_id = $1', [id]);

        const fullBill = { ...billDetails.rows[0], items: itemsResult.rows };
        res.json(fullBill);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

// @desc    Crear una nueva factura por pagar (Transacción)
const createBill = async (req, res) => {
    const { vendor_id, bill_number, issue_date, due_date, total_amount, status, items } = req.body;
    const userId = req.user.id;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const billQuery = `
            INSERT INTO bills (user_id, vendor_id, bill_number, issue_date, due_date, total_amount, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING bill_id;
        `;
        const newBill = await client.query(billQuery, [userId, vendor_id || null, bill_number, issue_date, due_date, total_amount, status]);
        const billId = newBill.rows[0].bill_id;

        for (const item of items) {
            const itemQuery = `
                INSERT INTO bill_items (bill_id, product_id, description, quantity, unit_price, line_total)
                VALUES ($1, $2, $3, $4, $5, $6);
            `;
            const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
            await client.query(itemQuery, [billId, item.product_id || null, item.description, item.quantity, item.unit_price, lineTotal]);
        }

        await client.query('COMMIT');
        res.status(201).json({ msg: 'Factura por pagar creada exitosamente', bill_id: billId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Error en el servidor al crear la factura por pagar.');
    } finally {
        client.release();
    }
};

// @desc    Actualizar una factura por pagar (Transacción)
const updateBill = async (req, res) => {
    const { id } = req.params;
    const { vendor_id, bill_number, issue_date, due_date, total_amount, status, items } = req.body;
    const userId = req.user.id;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const updateQuery = `
            UPDATE bills SET vendor_id = $1, bill_number = $2, issue_date = $3, due_date = $4, total_amount = $5, status = $6
            WHERE bill_id = $7 AND user_id = $8;
        `;
        await client.query(updateQuery, [vendor_id || null, bill_number, issue_date, due_date, total_amount, status, id, userId]);

        await client.query('DELETE FROM bill_items WHERE bill_id = $1', [id]);

        for (const item of items) {
            const itemQuery = `
                INSERT INTO bill_items (bill_id, product_id, description, quantity, unit_price, line_total)
                VALUES ($1, $2, $3, $4, $5, $6);
            `;
            const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
            await client.query(itemQuery, [id, item.product_id || null, item.description, item.quantity, item.unit_price, lineTotal]);
        }

        await client.query('COMMIT');
        res.json({ msg: 'Factura por pagar actualizada exitosamente' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Error en el servidor al actualizar la factura por pagar.');
    } finally {
        client.release();
    }
};

// @desc    Eliminar una factura por pagar
const deleteBill = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const deletedBill = await db.query('DELETE FROM bills WHERE bill_id = $1 AND user_id = $2 RETURNING *', [id, userId]);
        if (deletedBill.rows.length === 0) {
            return res.status(404).json({ msg: 'Factura por pagar no encontrada.' });
        }
        res.json({ msg: 'Factura por pagar eliminada.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor.');
    }
};

module.exports = { getBills, createBill, getBillById, updateBill, deleteBill };