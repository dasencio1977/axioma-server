// server/routes/products.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct
} = require('../controllers/productController');

// Aplicamos el middleware a todas las rutas.
router.use(authMiddleware);

// Rutas para obtener la lista de productos y crear uno nuevo.
router.route('/')
    .get(getProducts)
    .post(createProduct);

// Rutas para actualizar y eliminar un producto específico por su ID.
router.route('/:id')
    .put(updateProduct)
    .delete(deleteProduct);

module.exports = router;