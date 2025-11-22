const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getDashboardSummary, getIncomeVsExpenseChart, getExpenseByCategoryChart } = require('../controllers/dashboardController');

router.get('/summary', authMiddleware, getDashboardSummary);
router.get('/charts/income-expense', authMiddleware, getIncomeVsExpenseChart);
router.get('/charts/expense-by-category', authMiddleware, getExpenseByCategoryChart);

module.exports = router;