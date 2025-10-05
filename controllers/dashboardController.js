// server/controllers/dashboardController.js

const db = require('../config/db');

// @desc    Obtener un resumen de datos para el dashboard del usuario.
const getDashboardSummary = async (req, res) => {
    try {
        // Obtenemos el ID del usuario del token JWT, gracias al middleware.
        const userId = req.user.id;

        // --- EJECUTAREMOS MÚLTIPLES CONSULTAS EN PARALELO ---
        // Esto es mucho más eficiente que hacerlas una por una.
        // Promise.all espera a que todas las promesas (consultas) se completen.

        const [revenueResult, receivableResult, clientCountResult, overdueCountResult] = await Promise.all([
            // 1. Calcular Ingresos Totales (suma de facturas 'Pagada')
            db.query(
                // COALESCE es una función de SQL que devuelve 0 si el resultado de SUM es NULL (es decir, no hay facturas pagadas).
                "SELECT COALESCE(SUM(total_amount), 0) AS total_revenue FROM invoices WHERE user_id = $1 AND status = 'Pagada'",
                [userId]
            ),
            // 2. Calcular Cuentas por Cobrar (suma de facturas 'Enviada' o 'Vencida')
            db.query(
                "SELECT COALESCE(SUM(total_amount), 0) AS total_receivable FROM invoices WHERE user_id = $1 AND status IN ('Enviada', 'Vencida')",
                [userId]
            ),
            // 3. Contar el número total de clientes
            db.query(
                "SELECT COUNT(*) AS client_count FROM clients WHERE user_id = $1",
                [userId]
            ),
            // 4. Contar el número de facturas vencidas
            db.query(
                "SELECT COUNT(*) AS overdue_count FROM invoices WHERE user_id = $1 AND status = 'Vencida'",
                [userId]
            )
        ]);

        // --- CONSTRUIMOS EL OBJETO DE RESPUESTA ---
        // Extraemos los valores de los resultados de las consultas.
        const summary = {
            totalRevenue: parseFloat(revenueResult.rows[0].total_revenue),
            totalReceivable: parseFloat(receivableResult.rows[0].total_receivable),
            clientCount: parseInt(clientCountResult.rows[0].client_count),
            overdueCount: parseInt(overdueCountResult.rows[0].overdue_count)
        };

        // Enviamos el objeto de resumen como respuesta.
        res.json(summary);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor al obtener el resumen del dashboard');
    }
};

// @desc    Obtener datos para el gráfico de Ingresos vs Gastos
const getIncomeVsExpenseChart = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            WITH months AS (
                -- Generamos una serie de los últimos 6 meses
                SELECT DATE_TRUNC('month', GENERATE_SERIES(NOW() - INTERVAL '5 months', NOW(), '1 month'))::DATE AS month
            ),
            income AS (
                -- Calculamos los ingresos por mes
                SELECT DATE_TRUNC('month', p.payment_date)::DATE AS month, SUM(p.amount_paid) AS total
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.invoice_id
                WHERE i.user_id = $1
                GROUP BY 1
            ),
            expenses AS (
                -- Calculamos los gastos por mes
                SELECT DATE_TRUNC('month', expense_date)::DATE AS month, SUM(amount) AS total
                FROM expenses
                WHERE user_id = $1
                GROUP BY 1
            )
            -- Unimos todo para tener un resultado por mes
            SELECT
                TO_CHAR(m.month, 'Mon') AS label,
                COALESCE(i.total, 0) AS income,
                COALESCE(e.total, 0) AS expense
            FROM months m
            LEFT JOIN income i ON m.month = i.month
            LEFT JOIN expenses e ON m.month = e.month
            ORDER BY m.month;
        `;

        const result = await db.query(query, [userId]);

        // Formateamos los datos para que Chart.js los entienda fácilmente
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
        const userId = req.user.id;
        // Sumamos los montos y los agrupamos por categoría para el último año
        const query = `
            SELECT
                category,
                SUM(amount) as total
            FROM expenses
            WHERE user_id = $1 AND expense_date > NOW() - INTERVAL '1 year'
            GROUP BY category
            ORDER BY total DESC;
        `;
        const result = await db.query(query, [userId]);

        // Formateamos los datos para Chart.js
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