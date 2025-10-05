const db = require('../config/db');
const { createInvoicePdf } = require('../utils/createInvoicePdf');

// @desc    Crear una nueva factura y su asiento contable (Transacción)
const createInvoice = async (req, res) => {
    const { client_id, invoice_number, issue_date, due_date, total_amount, status, items } = req.body;
    const userId = req.user.id;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // Parte 1: Guardar la Factura
        const invoiceQuery = `
            INSERT INTO invoices (user_id, client_id, invoice_number, issue_date, due_date, total_amount, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING invoice_id;
        `;
        const newInvoice = await client.query(invoiceQuery, [userId, client_id, invoice_number, issue_date, due_date, total_amount, status]);
        const invoiceId = newInvoice.rows[0].invoice_id;

        for (const item of items) {
            const itemQuery = `
                INSERT INTO invoice_items (invoice_id, item_code, description, quantity, unit_price, line_total)
                VALUES ($1, $2, $3, $4, $5, $6);
            `;
            const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
            await client.query(itemQuery, [invoiceId, item.item_code || null, item.description, item.quantity, item.unit_price, lineTotal]);
        }

        // Parte 2: Lógica de Asiento Contable Automático
        const profileRes = await client.query('SELECT default_accounts_receivable, default_sales_income FROM profiles WHERE user_id = $1', [userId]);
        if (profileRes.rows.length === 0 || !profileRes.rows[0].default_accounts_receivable || !profileRes.rows[0].default_sales_income) {
            throw new Error('Por favor, configure sus Cuentas por Cobrar y Cuentas de Ingresos en la página de Configuración.');
        }
        const { default_accounts_receivable, default_sales_income } = profileRes.rows[0];

        const entryDesc = `Venta según Factura #${invoice_number}`;
        const entryQuery = `
            INSERT INTO journal_entries (user_id, entry_date, description, invoice_id)
            VALUES ($1, $2, $3, $4) RETURNING entry_id;
        `;
        const newEntry = await client.query(entryQuery, [userId, issue_date, entryDesc, invoiceId]);
        const entryId = newEntry.rows[0].entry_id;

        await client.query(`INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, 'Debito', $3);`, [entryId, default_accounts_receivable, total_amount]);
        await client.query(`INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, 'Credito', $3);`, [entryId, default_sales_income, total_amount]);

        await client.query('COMMIT');
        res.status(201).json({ msg: 'Factura y asiento contable creados exitosamente', invoice_id: invoiceId });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message || 'Error en el servidor al crear la factura.' });
    } finally {
        client.release();
    }
};

// @desc    Actualizar una factura y su asiento contable (Transacción)
const updateInvoice = async (req, res) => {
    const { id } = req.params;
    const { client_id, invoice_number, issue_date, due_date, total_amount, status, items } = req.body;
    const userId = req.user.id;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // 1. Borramos el asiento contable antiguo asociado a esta factura.
        await client.query('DELETE FROM journal_entries WHERE invoice_id = $1 AND user_id = $2', [id, userId]);

        // 2. Actualizamos la factura y sus items.
        await client.query(
            'UPDATE invoices SET client_id = $1, invoice_number = $2, issue_date = $3, due_date = $4, total_amount = $5, status = $6 WHERE invoice_id = $7 AND user_id = $8;',
            [client_id, invoice_number, issue_date, due_date, total_amount, status, id, userId]
        );
        await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);
        for (const item of items) {
            const itemQuery = `
                INSERT INTO invoice_items (invoice_id, item_code, description, quantity, unit_price, line_total)
                VALUES ($1, $2, $3, $4, $5, $6);
            `;
            const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
            await client.query(itemQuery, [id, item.item_code || null, item.description, item.quantity, item.unit_price, lineTotal]);
        }

        // 3. Creamos el nuevo asiento contable.
        const profileRes = await client.query('SELECT default_accounts_receivable, default_sales_income FROM profiles WHERE user_id = $1', [userId]);
        if (profileRes.rows.length === 0 || !profileRes.rows[0].default_accounts_receivable || !profileRes.rows[0].default_sales_income) {
            throw new Error('Por favor, configure sus cuentas vinculadas en la página de Configuración.');
        }
        const { default_accounts_receivable, default_sales_income } = profileRes.rows[0];
        const entryDesc = `Venta según Factura #${invoice_number}`;
        const entryQuery = `INSERT INTO journal_entries (user_id, entry_date, description, invoice_id) VALUES ($1, $2, $3, $4) RETURNING entry_id;`;
        const newEntry = await client.query(entryQuery, [userId, issue_date, entryDesc, id]);
        const entryId = newEntry.rows[0].entry_id;
        await client.query(`INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, 'Debito', $3);`, [entryId, default_accounts_receivable, total_amount]);
        await client.query(`INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, 'Credito', $3);`, [entryId, default_sales_income, total_amount]);

        await client.query('COMMIT');
        res.json({ msg: 'Factura y asiento contable actualizados exitosamente' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message || 'Error en el servidor al actualizar la factura.' });
    } finally {
        client.release();
    }
};

// @desc    Obtener todas las facturas de un usuario (con paginación)
const getInvoices = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [dataResult, countResult] = await Promise.all([
            db.query(`
                SELECT i.invoice_id, i.invoice_number, i.total_amount, i.status, i.due_date, c.client_name
                FROM invoices i
                JOIN clients c ON i.client_id = c.client_id
                WHERE i.user_id = $1 ORDER BY i.issue_date DESC LIMIT $2 OFFSET $3;
            `, [userId, limit, offset]),
            db.query('SELECT COUNT(*) FROM invoices WHERE user_id = $1', [userId])
        ]);

        const invoices = dataResult.rows;
        const totalPages = Math.ceil(parseInt(countResult.rows[0].count, 10) / limit);

        res.json({ invoices, totalPages, currentPage: page });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

// @desc    Obtener los detalles de una factura específica
const getInvoiceById = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const invoiceQuery = `
            SELECT i.*, c.client_name, c.address AS client_address, c.contact_email AS client_email
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.client_id
            WHERE i.invoice_id = $1 AND i.user_id = $2;
        `;
        const invoiceDetails = await db.query(invoiceQuery, [id, userId]);
        if (invoiceDetails.rows.length === 0) {
            return res.status(404).json({ msg: 'Factura no encontrada.' });
        }

        const [itemsResult, paymentsResult] = await Promise.all([
            db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]),
            db.query('SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC', [id])
        ]);

        const fullInvoice = { ...invoiceDetails.rows[0], items: itemsResult.rows, payments: paymentsResult.rows };
        res.json(fullInvoice);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

// @desc    Eliminar una factura
const deleteInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const deletedInvoice = await db.query('DELETE FROM invoices WHERE invoice_id = $1 AND user_id = $2', [id, userId]);
        if (deletedInvoice.rowCount === 0) {
            return res.status(404).json({ msg: 'Factura no encontrada.' });
        }
        res.json({ msg: 'Factura eliminada.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor.');
    }
};

// @desc    Añadir un pago a una factura
const addPaymentToInvoice = async (req, res) => {
    const { id: invoiceId } = req.params;
    const userId = req.user.id;
    const { amount_paid, payment_date } = req.body;

    if (!amount_paid || parseFloat(amount_paid) <= 0) {
        return res.status(400).json({ msg: 'El monto del pago debe ser un número positivo.' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const invoiceQuery = `SELECT i.total_amount, (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.invoice_id = i.invoice_id) AS paid_so_far FROM invoices i WHERE i.invoice_id = $1 AND i.user_id = $2;`;
        const invoiceRes = await client.query(invoiceQuery, [invoiceId, userId]);
        if (invoiceRes.rows.length === 0) throw new Error('Factura no encontrada.');

        const { total_amount, paid_so_far } = invoiceRes.rows[0];
        const balance_due = parseFloat(total_amount) - parseFloat(paid_so_far);
        if (parseFloat(amount_paid) > balance_due + 0.01) throw new Error(`El pago excede el saldo pendiente de $${balance_due.toFixed(2)}.`);

        await client.query(`INSERT INTO payments (invoice_id, user_id, amount_paid, payment_date) VALUES ($1, $2, $3, $4) RETURNING *;`, [invoiceId, userId, amount_paid, payment_date]);

        const newTotalPaid = parseFloat(paid_so_far) + parseFloat(amount_paid);
        const newStatus = newTotalPaid >= parseFloat(total_amount) ? 'Pagada' : 'Parcialmente Pagada';
        await client.query('UPDATE invoices SET status = $1 WHERE invoice_id = $2', [newStatus, invoiceId]);

        await client.query('COMMIT');
        res.status(201).json({ msg: 'Pago registrado exitosamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message || 'Error en el servidor al registrar el pago.' });
    } finally {
        client.release();
    }
};

// @desc    Actualizar solo el estado de una factura
const updateInvoiceStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = req.user.id;
        const allowedStatus = ['Borrador', 'Enviada', 'Vencida', 'Anulada'];
        if (!allowedStatus.includes(status)) {
            return res.status(400).json({ msg: 'Estado no válido o gestionado automáticamente.' });
        }
        const updatedInvoice = await db.query('UPDATE invoices SET status = $1 WHERE invoice_id = $2 AND user_id = $3 RETURNING *', [status, id, userId]);
        if (updatedInvoice.rows.length === 0) {
            return res.status(404).json({ msg: 'Factura no encontrada.' });
        }
        res.json(updatedInvoice.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor.');
    }
};

// @desc    Descargar una factura como PDF
const downloadInvoicePdf = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const [invoiceResult, profileResult] = await Promise.all([
            db.query(`SELECT i.*, c.client_name, c.address AS client_address FROM invoices i JOIN clients c ON i.client_id = c.client_id WHERE i.invoice_id = $1 AND i.user_id = $2;`, [id, userId]),
            db.query('SELECT * FROM profiles WHERE user_id = $1', [userId])
        ]);
        if (invoiceResult.rows.length === 0) return res.status(404).json({ msg: 'Factura no encontrada.' });

        const itemsResult = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
        const invoice = { ...invoiceResult.rows[0], items: itemsResult.rows };
        const profile = profileResult.rows[0] || {};

        const filename = `Factura-${invoice.invoice_number}.pdf`;
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        createInvoicePdf((chunk) => res.write(chunk), () => res.end(), invoice, profile);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error al generar el PDF.');
    }
};


module.exports = {
    createInvoice,
    updateInvoice,
    getInvoices,
    getInvoiceById,
    deleteInvoice,
    addPaymentToInvoice,
    updateInvoiceStatus,
    downloadInvoicePdf,
};