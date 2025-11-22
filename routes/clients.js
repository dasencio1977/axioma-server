const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getClients,
    createClient,
    updateClient,
    deleteClient
} = require('../controllers/clientController');

router.use(authMiddleware);

router.route('/')
    .get(getClients)
    .post(createClient);

router.route('/:id')
    .put(updateClient)
    .delete(deleteClient);

module.exports = router;