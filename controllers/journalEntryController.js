const db = require('../config/db');

const getJournalEntries = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [dataResult, countResult] = await Promise.all([
            db.query('SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY entry_date DESC LIMIT $2 OFFSET $3', [userId, limit, offset]),
            db.query('SELECT COUNT(*) FROM journal_entries WHERE user_id = $1', [userId])
        ]);

        const entries = dataResult.rows;
        const totalPages = Math.ceil(parseInt(countResult.rows[0].count, 10) / limit);

        res.json({ entries, totalPages, currentPage: page });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const createJournalEntry = async (req, res) => {
    const { entry_date, description, lines } = req.body;
    const userId = parseInt(req.user.id, 10);
    const client = await db.connect();

    try {
        if (!lines || lines.length < 2) {
            throw new Error('Un asiento contable debe tener al menos dos líneas.');
        }

        let totalDebits = 0;
        let totalCredits = 0;

        for (const line of lines) {
            const amount = parseFloat(line.amount);
            if (isNaN(amount) || amount <= 0) {
                throw new Error('Todas las líneas deben tener un monto positivo.');
            }
            if (line.line_type === 'Debito') {
                totalDebits += amount;
            } else if (line.line_type === 'Credito') {
                totalCredits += amount;
            }
        }

        if (totalDebits.toFixed(2) !== totalCredits.toFixed(2)) {
            throw new Error(`El asiento no está balanceado. Débitos: ${totalDebits.toFixed(2)}, Créditos: ${totalCredits.toFixed(2)}`);
        }

        await client.query('BEGIN');

        const entryQuery = `
            INSERT INTO journal_entries (user_id, entry_date, description)
            VALUES ($1, $2, $3) RETURNING entry_id;
        `;
        const newEntry = await client.query(entryQuery, [userId, entry_date, description]);
        const entryId = newEntry.rows[0].entry_id;

        for (const line of lines) {
            const lineQuery = `
                INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount)
                VALUES ($1, $2, $3, $4);
            `;
            await client.query(lineQuery, [entryId, line.account_id, line.line_type, line.amount]);
        }

        await client.query('COMMIT');
        res.status(201).json({ msg: 'Asiento contable creado exitosamente', entry_id: entryId });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message || 'Error en el servidor al crear el asiento.' });
    } finally {
        client.release();
    }
};

const getJournalEntryById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(req.user.id, 10);

        const entryRes = await db.query('SELECT * FROM journal_entries WHERE entry_id = $1 AND user_id = $2', [id, userId]);
        if (entryRes.rows.length === 0) return res.status(404).json({ msg: 'Asiento no encontrado.' });

        const linesRes = await db.query(`
            SELECT jel.*, a.account_name, a.account_number
            FROM journal_entry_lines jel
            JOIN accounts a ON jel.account_id = a.account_id
            WHERE jel.entry_id = $1 ORDER BY jel.line_type DESC;
        `, [id]);

        const fullEntry = { ...entryRes.rows[0], lines: linesRes.rows };
        res.json(fullEntry);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const updateJournalEntry = async (req, res) => {
    const { id } = req.params;
    const { entry_date, description, lines } = req.body;
    const userId = parseInt(req.user.id, 10);
    const client = await db.connect();

    try {
        if (!lines || lines.length < 2) throw new Error('Un asiento debe tener al menos dos líneas.');
        let totalDebits = 0; let totalCredits = 0;
        lines.forEach(line => {
            const amount = parseFloat(line.amount) || 0;
            if (line.line_type === 'Debito') totalDebits += amount; else totalCredits += amount;
        });
        if (totalDebits.toFixed(2) !== totalCredits.toFixed(2)) throw new Error('El asiento no está balanceado.');

        await client.query('BEGIN');
        await client.query('UPDATE journal_entries SET entry_date = $1, description = $2 WHERE entry_id = $3 AND user_id = $4', [entry_date, description, id, userId]);
        await client.query('DELETE FROM journal_entry_lines WHERE entry_id = $1', [id]);
        for (const line of lines) {
            await client.query('INSERT INTO journal_entry_lines (entry_id, account_id, line_type, amount) VALUES ($1, $2, $3, $4);', [id, line.account_id, line.line_type, line.amount]);
        }
        await client.query('COMMIT');
        res.json({ msg: 'Asiento actualizado con éxito.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ msg: err.message || 'Error al actualizar el asiento.' });
    } finally {
        client.release();
    }
};


module.exports = {
    getJournalEntries,
    createJournalEntry,
    getJournalEntryById,
    updateJournalEntry
};