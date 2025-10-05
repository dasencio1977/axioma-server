// server/routes/auth.js

const express = require('express');
const router = express.Router();
// Importamos las funciones del controlador que crearemos en el siguiente paso
const { registerUser, loginUser } = require('../controllers/authController');

// @ruta    POST /api/auth/register
router.post('/register', registerUser);

// @ruta    POST /api/auth/login
router.post('/login', loginUser);

module.exports = router;