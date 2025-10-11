// server/controllers/productController.js

const db = require('../config/db');

// @desc    Obtener productos del usuario (con paginación o todos)
const getProducts = async (req, res) => {
    try {
        const userId = req.user.id;

        // Lógica para permitir obtener TODOS los productos para los dropdowns
        if (req.query.all === 'true') {
            const allProducts = await db.query('SELECT * FROM products WHERE user_id = $1 ORDER BY name ASC', [userId]);
            return res.json(allProducts.rows);
        }

        // Lógica de paginación para la lista principal
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const [dataResult, countResult] = await Promise.all([
            db.query('SELECT * FROM products WHERE user_id = $1 ORDER BY name ASC LIMIT $2 OFFSET $3', [userId, limit, offset]),
            db.query('SELECT COUNT(*) FROM products WHERE user_id = $1', [userId])
        ]);

        const products = dataResult.rows;
        const totalProducts = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalProducts / limit);

        res.json({ products, totalPages, currentPage: page });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

// @desc    Crear un nuevo producto/servicio
const createProduct = async (req, res) => {
    try {
        const userId = req.user.id;
        const { code, name, product_type, price, cost, account_name, sub_account, tax_account, tax1_name, tax1_applies, tax2_name, tax2_applies, tax3_name, tax3_applies, tax4_name, tax4_applies } = req.body;

        const newProduct = await db.query(
            `INSERT INTO products (user_id, code, name, product_type, price, cost, account_name, sub_account, tax_account, tax1_name, tax1_applies, tax2_name, tax2_applies, tax3_name, tax3_applies, tax4_name, tax4_applies) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
            [userId, code, name, product_type, price, cost, account_name, sub_account, tax_account, tax1_name, tax1_applies, tax2_name, tax2_applies, tax3_name, tax3_applies, tax4_name, tax4_applies]
        );
        res.status(201).json(newProduct.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

// @desc    Actualizar un producto/servicio
const updateProduct = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { code, name, product_type, price, cost, account_name, sub_account, tax_account, tax1_name, tax1_applies, tax2_name, tax2_applies, tax3_name, tax3_applies, tax4_name, tax4_applies } = req.body;

        const updatedProduct = await db.query(
            `UPDATE products SET code = $1, name = $2, product_type = $3, price = $4, cost = $5, account_name = $6, sub_account = $7, tax_account = $8, tax1_name = $9, tax1_applies = $10, tax2_name = $11, tax2_applies = $12, tax3_name = $13, tax3_applies = $14, tax4_name = $15, tax4_applies = $16  WHERE product_id = $17 AND user_id = $18 RETURNING *`,
            [code, name, product_type, price, cost, account_name, sub_account, tax_account, tax1_name, tax1_applies, tax2_name, tax2_applies, tax3_name, tax3_applies, tax4_name, tax4_applies, id, userId]
        );

        if (updatedProduct.rows.length === 0) {
            return res.status(404).json({ msg: 'Producto no encontrado o no autorizado' });
        }
        res.json(updatedProduct.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

// @desc    Eliminar un producto/servicio
const deleteProduct = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const deletedProduct = await db.query('DELETE FROM products WHERE product_id = $1 AND user_id = $2 RETURNING *', [id, userId]);

        if (deletedProduct.rows.length === 0) {
            return res.status(404).json({ msg: 'Producto no encontrado o no autorizado' });
        }
        res.json({ msg: 'Producto eliminado correctamente' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

module.exports = {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
};