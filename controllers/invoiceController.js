const db = require('../config/db');
const { createInvoicePdf } = require('../utils/createInvoicePdf');

async function calculateInvoiceTotals(userId, items, client) {
    const profileRes = await client.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
    if (profileRes.rows.length === 0) throw new Error('Perfil de empresa no encontrado. Por favor, configure sus tasas de impuesto en la página de Configuración.');
    const profile = profileRes.rows[0];

    let subtotal = 0;
    const taxTotals = { tax1_total: 0, tax2_total: 0, tax3_total: 0, tax4_total: 0 };
    const processedItems = [];

    for (const item of items) {
        const productId = parseInt(item.product_id, 10);
        if (isNaN(productId)) throw new Error(`Uno de los items no tiene un producto válido seleccionado.`);

        const productRes = await client.query('SELECT * FROM products WHERE product_id = $1 AND user_id = $2', [productId, userId]);
        if (productRes.rows.length === 0) throw new Error(`Producto con ID ${productId} no encontrado.`);
        const product = productRes.rows[0];

        const lineSubtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
        subtotal += lineSubtotal;

        const lineTaxes = { tax1_amount: 0, tax2_amount: 0, tax3_amount: 0, tax4_amount: 0 };
        if (product.tax1_applies && profile.tax1_rate > 0) lineTaxes.tax1_amount = lineSubtotal * (parseFloat(profile.tax1_rate) || 0);
        if (product.tax2_applies && profile.tax2_rate > 0) lineTaxes.tax2_amount = lineSubtotal * (parseFloat(profile.tax2_rate) || 0);
        if (product.tax3_applies && profile.tax3_rate > 0) lineTaxes.tax3_amount = lineSubtotal * (parseFloat(profile.tax3_rate) || 0);
        if (product.tax4_applies && profile.tax4_rate > 0) lineTaxes.tax4_amount = lineSubtotal * (parseFloat(profile.tax4_rate) || 0);

        taxTotals.tax1_total += lineTaxes.tax1_amount;
        taxTotals.tax2_total += lineTaxes.tax2_amount;
        taxTotals.tax3_total += lineTaxes.tax3_amount;
        taxTotals.tax4_total += lineTaxes.tax4_amount;

        processedItems.push({ ...item, line_total: lineSubtotal, ...lineTaxes });
    }

    const grandTotal = subtotal + taxTotals.tax1_total + taxTotals.tax2_total + taxTotals.tax3_total + taxTotals.tax4_total;
    return { subtotal, taxTotals, grandTotal, processedItems };
}

const createInvoice = async (req, res) => {
    const { client_id, invoice_number, issue_date, due_date, status, items } = req.body;
    const userId = parseInt(req.user.id, 10);
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { subtotal, taxTotals, grandTotal, processedItems } = await calculateInvoiceTotals(userId, items, client);

        const invoiceQuery = `INSERT INTO invoices (user_id, client_id, invoice_number, issue_date, due_date, status, subtotal, tax1_total, tax2_total, tax3_total, tax4_total, total_amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING invoice_id;`;
        const newInvoice = await client.query(invoiceQuery, [userId, client_id, invoice_number, issue_date, due_date, status, subtotal, taxTotals.tax1_total, taxTotals.tax2_total, taxTotals.tax3_total, taxTotals.tax4_total, grandTotal]);
        const invoiceId = newInvoice.rows[0].invoice_id;

        for (const item of processedItems) {
            const itemQuery = `INSERT INTO invoice_items (invoice_id, product_id, item_code, description, quantity, unit_price, line_total, tax1_amount, tax2_amount, tax3_amount, tax4_amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`;
            await client.query(itemQuery, [invoiceId, item.product_id, item.item_code, item.description, item.quantity, item.unit_price, item.line_total, item.tax1_amount, item.tax2_amount, item.tax3_amount, item.tax4_amount]);
        }

        const profileRes = await client.query('SELECT default_accounts_receivable, default_sales_income FROM profiles WHERE user_id = $1', [userId]);
        if (profileRes.rows.length === 0 || !profileRes.rows[0].default_accounts_receivable || !profileRes.rows[0].default_sales_income) {
            throw new Error('Por favor, configure sus cuentas vinculadas.');
        }
        const { default_accounts_receivable, default_sales_income } = profileRes.rows[0];
        const entryDesc = `Venta según Factura #${invoice_number}`;
        const entryQuery = `INSERT INTO journal_entries (user_id, entry_date, description, invoice_id) VALUES ($1, $2, $3, $4) RETURNING entry_id;`;
        const newEntry = await client.query(entryQuery, [userId, issue_date, entryDesc, invoiceId]);
        const entryId = newEntry.rows[0].entry_id;

        await client.query(`INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, 'Debito', $3);`, [entryId, default_accounts_receivable, grandTotal]);
        await client.query(`INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, 'Credito', $3);`, [entryId, default_sales_income, subtotal]);
        // TODO: Añadir líneas de crédito para cada cuenta de impuesto

        await client.query('COMMIT');
        res.status(201).json({ msg: 'Factura y asiento contable creados exitosamente' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message });
    } finally {
        client.release();
    }
};

const updateInvoice = async (req, res) => {
    const { id } = req.params;
    const { client_id, invoice_number, issue_date, due_date, status, items } = req.body;
    const userId = parseInt(req.user.id, 10);
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM journal_entries WHERE invoice_id = $1 AND user_id = $2', [id, userId]);
        await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);

        const { subtotal, taxTotals, grandTotal, processedItems } = await calculateInvoiceTotals(userId, items, client);

        const invoiceQuery = `UPDATE invoices SET client_id = $1, invoice_number = $2, issue_date = $3, due_date = $4, status = $5, subtotal = $6, tax1_total = $7, tax2_total = $8, tax3_total = $9, tax4_total = $10, total_amount = $11 WHERE invoice_id = $12 AND user_id = $13;`;
        await client.query(invoiceQuery, [client_id, invoice_number, issue_date, due_date, status, subtotal, taxTotals.tax1_total, taxTotals.tax2_total, taxTotals.tax3_total, taxTotals.tax4_total, grandTotal, id, userId]);

        for (const item of processedItems) {
            const itemQuery = `INSERT INTO invoice_items (invoice_id, product_id, item_code, description, quantity, unit_price, line_total, tax1_amount, tax2_amount, tax3_amount, tax4_amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`;
            await client.query(itemQuery, [id, item.product_id, item.item_code, item.description, item.quantity, item.unit_price, item.line_total, item.tax1_amount, item.tax2_amount, item.tax3_amount, item.tax4_amount]);
        }

        const profileRes = await client.query('SELECT default_accounts_receivable, default_sales_income FROM profiles WHERE user_id = $1', [userId]);
        if (profileRes.rows.length === 0 || !profileRes.rows[0].default_accounts_receivable || !profileRes.rows[0].default_sales_income) {
            throw new Error('Por favor, configure sus cuentas vinculadas.');
        }
        const { default_accounts_receivable, default_sales_income } = profileRes.rows[0];
        const entryDesc = `Venta según Factura #${invoice_number}`;
        const entryQuery = `INSERT INTO journal_entries (user_id, entry_date, description, invoice_id) VALUES ($1, $2, $3, $4) RETURNING entry_id;`;
        const newEntry = await client.query(entryQuery, [userId, issue_date, entryDesc, id]);
        const entryId = newEntry.rows[0].entry_id;
        await client.query(`INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, 'Debito', $3);`, [entryId, default_accounts_receivable, grandTotal]);
        await client.query(`INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, 'Credito', $3);`, [entryId, default_sales_income, subtotal]);

        await client.query('COMMIT');
        res.json({ msg: 'Factura y asiento contable actualizados exitosamente' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message });
    } finally {
        client.release();
    }
};

const getInvoices = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const query = `
            SELECT
                i.invoice_id, i.invoice_number, i.total_amount, i.status, i.due_date, c.client_name,
                COALESCE(p.total_paid, 0) as amount_paid
            FROM invoices i
            JOIN clients c ON i.client_id = c.client_id
            LEFT JOIN (
                SELECT invoice_id, SUM(amount_paid) as total_paid
                FROM payments
                GROUP BY invoice_id
            ) p ON i.invoice_id = p.invoice_id
            WHERE i.user_id = $1
            ORDER BY i.issue_date DESC
            LIMIT $2 OFFSET $3;
        `;
        const [dataResult, countResult] = await Promise.all([
            db.query(query, [userId, limit, offset]),
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

const getInvoiceById = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
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

const getNextInvoiceNumber = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const query = `
            SELECT invoice_number FROM invoices
            WHERE user_id = $1 AND invoice_number LIKE 'INV-%'
            ORDER BY CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER) DESC
            LIMIT 1;
        `;
        const result = await db.query(query, [userId]);
        let nextNumber = 1;
        if (result.rows.length > 0) {
            const lastNumberStr = result.rows[0].invoice_number.split('-')[1];
            const lastNumber = parseInt(lastNumberStr, 10);
            nextNumber = lastNumber + 1;
        }
        const nextInvoiceNumber = `INV-${String(nextNumber).padStart(4, '0')}`;
        res.json({ nextInvoiceNumber });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor al generar el número de factura');
    }
};

const deleteInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(req.user.id, 10);
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

const addPaymentToInvoice = async (req, res) => {
    const { id: invoiceId } = req.params;
    const userId = parseInt(req.user.id, 10);
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

const updateInvoiceStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = parseInt(req.user.id, 10);
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

const downloadInvoicePdf = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(req.user.id, 10);
        const [invoiceResult, profileResult] = await Promise.all([
            db.query(`SELECT i.*, c.client_name, c.address AS client_address FROM invoices i JOIN clients c ON i.client_id = c.client_id WHERE i.invoice_id = $1 AND user_id = $2;`, [id, userId]),
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
    getNextInvoiceNumber,
};