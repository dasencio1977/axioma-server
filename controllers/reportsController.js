const db = require('../config/db');
const { createPlReportPdf } = require('../utils/createPlReportPdf');
const { createTrialBalancePdf } = require('../utils/createTrialBalancePdf');
const { createBsReportPdf } = require('../utils/createBsReportPdf');
const { createCashFlowPdf } = require('../utils/createCashFlowPdf');

async function getTrialBalanceData(userId, asOfDate) {
    const query = `
        SELECT a.account_id, a.account_number, a.account_name, a.account_type,
            COALESCE(SUM(CASE WHEN jel.line_type = 'Debito' THEN jel.amount ELSE 0 END), 0) as total_debits,
            COALESCE(SUM(CASE WHEN jel.line_type = 'Credito' THEN jel.amount ELSE 0 END), 0) as total_credits
        FROM accounts a
        LEFT JOIN journal_entry_lines jel ON a.account_id = jel.account_id
        LEFT JOIN journal_entries je ON jel.entry_id = je.entry_id
        WHERE a.user_id = $1 AND (je.entry_date <= $2 OR je.entry_date IS NULL)
        GROUP BY a.account_id ORDER BY a.account_number;
    `;
    const result = await db.query(query, [userId, asOfDate]);
    return result.rows.map(account => {
        const debits = parseFloat(account.total_debits);
        const credits = parseFloat(account.total_credits);
        let debit_balance = (['Activo', 'Gasto'].includes(account.account_type)) ? debits - credits : 0;
        let credit_balance = (['Pasivo', 'Patrimonio', 'Ingreso'].includes(account.account_type)) ? credits - debits : 0;
        return { ...account, debit_balance: debit_balance > 0 ? debit_balance : 0, credit_balance: credit_balance > 0 ? credit_balance : 0 };
    }).filter(account => account.debit_balance !== 0 || account.credit_balance !== 0);
}

async function getProfitLossData(userId, startDate, endDate) {
    const [incomeResult, expensesResult] = await Promise.all([
        db.query("SELECT COALESCE(SUM(total_amount), 0) AS total_income FROM invoices WHERE user_id = $1 AND status = 'Pagada' AND issue_date BETWEEN $2 AND $3", [userId, startDate, endDate]),
        db.query("SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses WHERE user_id = $1 AND expense_date BETWEEN $2 AND $3", [userId, startDate, endDate])
    ]);
    const totalIncome = parseFloat(incomeResult.rows[0].total_income);
    const totalExpenses = parseFloat(expensesResult.rows[0].total_expenses);
    return { totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses, startDate, endDate };
}

const getProfitLossReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        if (!startDate || !endDate) return res.status(400).json({ msg: 'Por favor, proporciona un rango de fechas.' });
        const reportData = await getProfitLossData(req.user.id, startDate, endDate);
        res.json(reportData);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor al generar el reporte P&L');
    }
};

const getTrialBalance = async (req, res) => {
    try {
        const { asOfDate } = req.body;
        if (!asOfDate) return res.status(400).json({ msg: 'Por favor, proporciona una fecha.' });
        const accounts = await getTrialBalanceData(req.user.id, asOfDate);
        res.json(accounts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor al generar el balance de comprobación');
    }
};

const getBalanceSheet = async (req, res) => {
    try {
        const { asOfDate } = req.body;
        if (!asOfDate) return res.status(400).json({ msg: 'Por favor, proporciona una fecha.' });
        const allAccounts = await getTrialBalanceData(req.user.id, asOfDate);
        const assets = [], liabilities = [], equity = [];
        let netIncome = 0;
        allAccounts.forEach(account => {
            const balance = account.debit_balance > 0 ? account.debit_balance : account.credit_balance;
            switch (account.account_type) {
                case 'Activo': assets.push({ name: account.account_name, balance }); break;
                case 'Pasivo': liabilities.push({ name: account.account_name, balance }); break;
                case 'Patrimonio': equity.push({ name: account.account_name, balance }); break;
                case 'Ingreso': netIncome += balance; break;
                case 'Gasto': netIncome -= balance; break;
            }
        });
        if (netIncome !== 0) equity.push({ name: 'Ganancias Retenidas / Pérdida Neta', balance: netIncome });
        const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
        const totalLiabilitiesAndEquity = liabilities.reduce((sum, acc) => sum + acc.balance, 0) + equity.reduce((sum, acc) => sum + acc.balance, 0);
        res.json({ assets, liabilities, equity, totalAssets, totalLiabilitiesAndEquity });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor al generar el Balance General');
    }
};

const downloadPlReportPdf = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        const userId = req.user.id;
        const [profile, reportData] = await Promise.all([
            db.query('SELECT company_name FROM profiles WHERE user_id = $1', [userId]),
            getProfitLossData(userId, startDate, endDate)
        ]);
        res.setHeader('Content-disposition', `attachment; filename="Ganancias_Perdidas_${endDate}.pdf"`);
        res.setHeader('Content-type', 'application/pdf');
        createPlReportPdf(d => res.write(d), () => res.end(), reportData, profile.rows[0] || {});
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error al generar el PDF de Ganancias y Pérdidas.');
    }
};

const downloadTbReportPdf = async (req, res) => {
    try {
        const { asOfDate } = req.body;
        const userId = req.user.id;
        const [reportData, profileResult] = await Promise.all([
            getTrialBalanceData(userId, asOfDate),
            db.query('SELECT company_name FROM profiles WHERE user_id = $1', [userId])
        ]);
        const profile = profileResult.rows[0] || {};
        res.setHeader('Content-disposition', `attachment; filename="Balance_Comprobacion_${asOfDate}.pdf"`);
        res.setHeader('Content-type', 'application/pdf');
        createTrialBalancePdf(chunk => res.write(chunk), () => res.end(), reportData, profile, asOfDate);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error al generar el PDF del Balance de Comprobación.');
    }
};

const downloadBsReportPdf = async (req, res) => {
    try {
        const { asOfDate } = req.body;
        const userId = req.user.id;

        const allAccounts = await getTrialBalanceData(userId, asOfDate);
        const assets = [], liabilities = [], equity = [];
        let netIncome = 0;
        allAccounts.forEach(account => {
            const balance = account.debit_balance > 0 ? account.debit_balance : account.credit_balance;
            if (balance === 0) return;
            switch (account.account_type) {
                case 'Activo': assets.push({ name: account.account_name, balance }); break;
                case 'Pasivo': liabilities.push({ name: account.account_name, balance }); break;
                case 'Patrimonio': equity.push({ name: account.account_name, balance }); break;
                case 'Ingreso': netIncome += balance; break;
                case 'Gasto': netIncome -= balance; break;
            }
        });
        if (netIncome !== 0) equity.push({ name: 'Ganancias Retenidas / Pérdida Neta', balance: netIncome });
        const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
        const totalLiabilitiesAndEquity = liabilities.reduce((sum, acc) => sum + acc.balance, 0) + equity.reduce((sum, acc) => sum + acc.balance, 0);
        const reportData = { assets, liabilities, equity, totalAssets, totalLiabilitiesAndEquity };

        const profileResult = await db.query('SELECT company_name FROM profiles WHERE user_id = $1', [userId]);
        const profile = profileResult.rows[0] || {};

        res.setHeader('Content-disposition', `attachment; filename="Balance_General_${asOfDate}.pdf"`);
        res.setHeader('Content-type', 'application/pdf');
        createBsReportPdf(chunk => res.write(chunk), () => res.end(), reportData, profile, asOfDate);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error al generar el PDF del Balance General.');
    }
};
// @desc    Generar un Estado de Flujo de Caja (Método Directo Simplificado)
const getCashFlowStatement = async (req, res) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate } = req.body;
        if (!startDate || !endDate) return res.status(400).json({ msg: 'Por favor, proporciona un rango de fechas.' });

        // 1. Entradas de Efectivo por Operaciones
        const cashInflowsQuery = `
            SELECT COALESCE(SUM(amount_paid), 0) as total_inflows
            FROM payments
            WHERE user_id = $1 AND payment_date BETWEEN $2 AND $3;
        `;
        const inflowsResult = await db.query(cashInflowsQuery, [userId, startDate, endDate]);
        const totalInflows = parseFloat(inflowsResult.rows[0].total_inflows);

        // 2. Salidas de Efectivo por Operaciones
        // Sumamos los gastos directos y las facturas por pagar que han sido pagadas
        const cashOutflowsExpensesQuery = `
            SELECT COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE user_id = $1 AND expense_date BETWEEN $2 AND $3;
        `;
        const cashOutflowsBillsQuery = `
            SELECT COALESCE(SUM(total_amount), 0) as total
            FROM bills
            WHERE user_id = $1 AND status = 'Pagada' AND due_date BETWEEN $2 AND $3; 
            -- Nota: Usamos due_date como proxy de la fecha de pago de la factura. Un sistema más avanzado tendría una tabla de "pagos de facturas por pagar".
        `;
        const [outflowsExpensesResult, outflowsBillsResult] = await Promise.all([
            db.query(cashOutflowsExpensesQuery, [userId, startDate, endDate]),
            db.query(cashOutflowsBillsQuery, [userId, startDate, endDate])
        ]);
        const totalOutflows = parseFloat(outflowsExpensesResult.rows[0].total) + parseFloat(outflowsBillsResult.rows[0].total);

        // 3. Flujo de Caja Neto de Operaciones
        const netCashFlow = totalInflows - totalOutflows;

        res.json({
            operatingActivities: {
                inflows: totalInflows,
                outflows: totalOutflows,
                net: netCashFlow,
            },
            // A futuro se podrían añadir Investing y Financing Activities
            startDate,
            endDate
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor al generar el Flujo de Caja');
    }
};

const downloadCashFlowPdf = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        const userId = req.user.id;

        // Reutilizamos la lógica de getCashFlowStatement
        const cashInflowsQuery = `SELECT COALESCE(SUM(amount_paid), 0) as total_inflows FROM payments WHERE user_id = $1 AND payment_date BETWEEN $2 AND $3;`;
        const inflowsResult = await db.query(cashInflowsQuery, [userId, startDate, endDate]);
        const totalInflows = parseFloat(inflowsResult.rows[0].total_inflows);

        const cashOutflowsExpensesQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = $1 AND expense_date BETWEEN $2 AND $3;`;
        const cashOutflowsBillsQuery = `SELECT COALESCE(SUM(total_amount), 0) as total FROM bills WHERE user_id = $1 AND status = 'Pagada' AND due_date BETWEEN $2 AND $3;`;
        const [outflowsExpensesResult, outflowsBillsResult] = await Promise.all([
            db.query(cashOutflowsExpensesQuery, [userId, startDate, endDate]),
            db.query(cashOutflowsBillsQuery, [userId, startDate, endDate])
        ]);
        const totalOutflows = parseFloat(outflowsExpensesResult.rows[0].total) + parseFloat(outflowsBillsResult.rows[0].total);
        const netCashFlow = totalInflows - totalOutflows;

        const reportData = {
            operatingActivities: { inflows: totalInflows, outflows: totalOutflows, net: netCashFlow },
            startDate, endDate
        };

        const profileResult = await db.query('SELECT company_name FROM profiles WHERE user_id = $1', [userId]);
        const profile = profileResult.rows[0] || {};

        res.setHeader('Content-disposition', `attachment; filename="Flujo_de_Caja_${endDate}.pdf"`);
        res.setHeader('Content-type', 'application/pdf');
        createCashFlowPdf(d => res.write(d), () => res.end(), reportData, profile);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error al generar el PDF de Flujo de Caja.');
    }
};

const getGeneralLedger = async (req, res) => {
    try {
        const userId = req.user.id;
        const { accountId, startDate, endDate } = req.body;
        if (!accountId || !startDate || !endDate) {
            return res.status(400).json({ msg: 'Se requiere una cuenta y un rango de fechas.' });
        }

        // 1. Obtener la información de la cuenta seleccionada
        const accountRes = await db.query('SELECT * FROM accounts WHERE account_id = $1 AND user_id = $2', [accountId, userId]);
        if (accountRes.rows.length === 0) return res.status(404).json({ msg: 'Cuenta no encontrada.' });
        const account = accountRes.rows[0];

        // 2. Calcular el Saldo Inicial (balance antes de la fecha de inicio)
        const openingBalanceQuery = `
            SELECT
                COALESCE(SUM(CASE WHEN jel.line_type = 'Debito' THEN jel.amount ELSE 0 END), 0) as total_debits,
                COALESCE(SUM(CASE WHEN jel.line_type = 'Credito' THEN jel.amount ELSE 0 END), 0) as total_credits
            FROM journal_entry_lines jel
            JOIN journal_entries je ON jel.entry_id = je.entry_id
            WHERE jel.account_id = $1 AND je.user_id = $2 AND je.entry_date < $3;
        `;
        const obRes = await db.query(openingBalanceQuery, [accountId, userId, startDate]);
        const { total_debits, total_credits } = obRes.rows[0];
        let openingBalance = 0;
        if (['Activo', 'Gasto'].includes(account.account_type)) {
            openingBalance = parseFloat(total_debits) - parseFloat(total_credits);
        } else {
            openingBalance = parseFloat(total_credits) - parseFloat(total_debits);
        }

        // 3. Obtener todas las transacciones dentro del rango de fechas
        const transactionsQuery = `
            SELECT je.entry_date, je.description, jel.line_type, jel.amount
            FROM journal_entry_lines jel
            JOIN journal_entries je ON jel.entry_id = je.entry_id
            WHERE jel.account_id = $1 AND je.user_id = $2 AND je.entry_date BETWEEN $3 AND $4
            ORDER BY je.entry_date, je.entry_id;
        `;
        const transRes = await db.query(transactionsQuery, [accountId, userId, startDate, endDate]);

        // 4. Calcular el saldo corriente para cada transacción
        let runningBalance = openingBalance;
        const transactions = transRes.rows.map(t => {
            const amount = parseFloat(t.amount);
            if (['Activo', 'Gasto'].includes(account.account_type)) {
                runningBalance += (t.line_type === 'Debito' ? amount : -amount);
            } else {
                runningBalance += (t.line_type === 'Credito' ? amount : -amount);
            }
            return { ...t, runningBalance };
        });

        const closingBalance = runningBalance;

        res.json({
            accountName: `${account.account_number} - ${account.account_name}`,
            openingBalance,
            transactions,
            closingBalance
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor al generar el Libro Mayor');
    }
};

module.exports = {
    getProfitLossReport,
    getTrialBalance,
    getBalanceSheet,
    getCashFlowStatement,
    downloadPlReportPdf,
    downloadTbReportPdf,
    downloadBsReportPdf,
    downloadCashFlowPdf,
    getGeneralLedger

};