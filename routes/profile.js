// server/routes/profile.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getProfile, upsertProfile } = require('../controllers/profileController');

// Aplicamos el middleware a todas las rutas de perfil.
router.use(authMiddleware);

// Definimos una única ruta que maneja tanto GET como PUT.
router.route('/')
    .get(getProfile)
    .put(upsertProfile);

module.exports = router;