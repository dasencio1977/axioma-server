const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct
} = require('../controllers/productController');

router.use(authMiddleware);

router.route('/')
    .get(getProducts)
    .post(createProduct);

router.route('/:id')
    .put(updateProduct)
    .delete(deleteProduct);

module.exports = router;