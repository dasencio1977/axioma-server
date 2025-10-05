// server/routes/dashboard.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getDashboardSummary, getIncomeVsExpenseChart, getExpenseByCategoryChart } = require('../controllers/dashboardController');

// Protegemos la ruta con nuestro middleware de autenticación.
router.get('/summary', authMiddleware, getDashboardSummary);
router.get('/charts/income-expense', authMiddleware, getIncomeVsExpenseChart);
router.get('/charts/expense-by-category', authMiddleware, getExpenseByCategoryChart);

module.exports = router;