const db = require('../config/db');

// @desc    Obtener el resumen de 4 KPIs para el dashboard
const getDashboardSummary = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);

        const [revenueResult, receivableResult, clientCountResult, overdueCountResult] = await Promise.all([
            // 1. Calcular Ingresos Totales (Facturas 'Pagada')
            db.query(
                "SELECT COALESCE(SUM(total_amount), 0) AS total_revenue FROM invoices WHERE user_id = $1 AND status = 'Pagada'",
                [userId]
            ),
            // 2. Calcular Cuentas por Cobrar (Saldo pendiente de facturas no pagadas)
            db.query(`
                SELECT COALESCE(SUM(i.total_amount - COALESCE(p.total_paid, 0)), 0) AS total_receivable
                FROM invoices i
                LEFT JOIN (
                    SELECT invoice_id, SUM(amount_paid) as total_paid
                    FROM payments
                    GROUP BY invoice_id
                ) p ON i.invoice_id = p.invoice_id
                WHERE i.user_id = $1 AND i.status IN ('Enviada', 'Vencida', 'Parcialmente Pagada');
            `, [userId]),
            // 3. Contar clientes
            db.query(
                "SELECT COUNT(*) AS client_count FROM clients WHERE user_id = $1",
                [userId]
            ),
            // 4. Contar facturas vencidas (en tiempo real)
            db.query(`
                SELECT COUNT(*) AS overdue_count 
                FROM invoices 
                WHERE user_id = $1 
                AND status IN ('Enviada', 'Parcialmente Pagada') 
                AND due_date < CURRENT_DATE;
            `, [userId])
        ]);

        const summary = {
            totalRevenue: parseFloat(revenueResult.rows[0].total_revenue),
            totalReceivable: parseFloat(receivableResult.rows[0].total_receivable),
            clientCount: parseInt(clientCountResult.rows[0].client_count),
            overdueCount: parseInt(overdueCountResult.rows[0].overdue_count)
        };

        res.json(summary);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor al obtener el resumen del dashboard');
    }
};

// @desc    Obtener datos para el gráfico de Ingresos vs Gastos (con rango de meses)
const getIncomeVsExpenseChart = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);

        // Leemos el rango de meses (default: 6)
        const monthsToQuery = (parseInt(req.query.months, 10) || 6) - 1;
        const interval = `${monthsToQuery} months`;

        const query = `
            WITH months AS (
                -- Usamos el rango dinámico
                SELECT DATE_TRUNC('month', GENERATE_SERIES(NOW() - ($2::INTERVAL), NOW(), '1 month'))::DATE AS month
            ),
            income AS (
                -- Calculamos ingresos (basado en pagos recibidos)
                SELECT DATE_TRUNC('month', p.payment_date)::DATE AS month, SUM(p.amount_paid) AS total
                FROM payments p
                WHERE p.user_id = $1 AND p.payment_date > NOW() - ($2::INTERVAL)
                GROUP BY 1
            ),
            expenses AS (
                -- Calculamos gastos (basado en gastos y facturas pagadas)
                (
                    SELECT DATE_TRUNC('month', expense_date)::DATE AS month, SUM(amount) AS total
                    FROM expenses
                    WHERE user_id = $1 AND expense_date > NOW() - ($2::INTERVAL)
                    GROUP BY 1
                )
                UNION ALL
                (
                    SELECT DATE_TRUNC('month', due_date)::DATE AS month, SUM(total_amount) AS total
                    FROM bills
                    WHERE user_id = $1 AND status = 'Pagada' AND due_date > NOW() - ($2::INTERVAL)
                    GROUP BY 1
                )
            ),
            expenses_total AS (
                SELECT month, SUM(total) as total
                FROM expenses
                GROUP BY 1
            )
            SELECT
                TO_CHAR(m.month, 'Mon YYYY') AS label,
                COALESCE(i.total, 0) AS income,
                COALESCE(e.total, 0) AS expense
            FROM months m
            LEFT JOIN income i ON m.month = i.month
            LEFT JOIN expenses_total e ON m.month = e.month
            ORDER BY m.month;
        `;

        const result = await db.query(query, [userId, interval]);

        const labels = result.rows.map(r => r.label);
        const incomeData = result.rows.map(r => r.income);
        const expenseData = result.rows.map(r => r.expense);

        res.json({ labels, incomeData, expenseData });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor al generar datos del gráfico');
    }
};

// @desc    Obtener datos para el gráfico de Gastos por Categoría
const getExpenseByCategoryChart = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        // Sumamos los montos y los agrupamos por categoría de cuenta contable
        const query = `
            SELECT
                a.account_name as category,
                SUM(e.amount) as total
            FROM expenses e
            JOIN accounts a ON e.expense_account_id = a.account_id
            WHERE e.user_id = $1 AND e.expense_date > NOW() - INTERVAL '1 year'
            GROUP BY a.account_name
            ORDER BY total DESC;
        `;
        const result = await db.query(query, [userId]);

        const labels = result.rows.map(r => r.category || 'Sin Categoría');
        const data = result.rows.map(r => r.total);

        res.json({ labels, data });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor al generar datos del gráfico');
    }
};

module.exports = {
    getDashboardSummary,
    getIncomeVsExpenseChart,
    getExpenseByCategoryChart,
};