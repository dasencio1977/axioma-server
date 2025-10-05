// server/routes/expenses.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// Importamos las funciones del controlador que crearemos a continuación.
const {
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense
} = require('../controllers/expenseController');

// Aplicamos el middleware de autenticación a todas las rutas de este archivo.
router.use(authMiddleware);

// Rutas para obtener la lista de gastos y crear uno nuevo.
router.route('/')
    .get(getExpenses)
    .post(createExpense);

// Rutas para actualizar y eliminar un gasto específico por su ID.
router.route('/:id')
    .put(updateExpense)
    .delete(deleteExpense);

module.exports = router;