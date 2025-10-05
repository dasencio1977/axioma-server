// server/routes/clients.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// Importamos los controladores que crearemos a continuación
const {
    getClients,
    createClient,
    updateClient,
    deleteClient
} = require('../controllers/clientController');

// Aplicamos el middleware a todas las rutas de este archivo
// Cualquier petición a /api/clients/* primero pasará por authMiddleware
router.use(authMiddleware);

// Definimos las rutas del CRUD
router.route('/')
    .get(getClients)
    .post(createClient);

router.route('/:id')
    .put(updateClient)
    .delete(deleteClient);

module.exports = router;