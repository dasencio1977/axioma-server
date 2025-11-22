const db = require('../config/db');

const getProducts = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const baseQuery = `
            SELECT p.*, a.account_name as gl_account_name
            FROM products p
            LEFT JOIN accounts a ON p.gl_account_id = a.account_id
            WHERE p.user_id = $1
        `;

        if (req.query.all === 'true') {
            const allProducts = await db.query(`${baseQuery} ORDER BY p.name ASC`, [userId]);
            return res.json(allProducts.rows);
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;
        const [dataResult, countResult] = await Promise.all([
            db.query(`${baseQuery} ORDER BY p.name ASC LIMIT $2 OFFSET $3`, [userId, limit, offset]),
            db.query('SELECT COUNT(*) FROM products WHERE user_id = $1', [userId])
        ]);
        const products = dataResult.rows;
        const totalPages = Math.ceil(parseInt(countResult.rows[0].count, 10) / limit);
        res.json({ products, totalPages, currentPage: page });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const createProduct = async (req, res) => {
    try {
<<<<<<< HEAD
        const userId = parseInt(req.user.id, 10);
        const {
            code, name, product_type, price, cost, gl_account_id,
            is_sales_item, is_purchase_item, is_service_item,
            tax1_name, tax1_applies, tax2_name, tax2_applies,
            tax3_name, tax3_applies, tax4_name, tax4_applies
        } = req.body;

        const newProduct = await db.query(
            `INSERT INTO products (
                user_id, code, name, product_type, price, cost, gl_account_id, 
                is_sales_item, is_purchase_item, is_service_item, 
                tax1_name, tax1_applies, tax2_name, tax2_applies, 
                tax3_name, tax3_applies, tax4_name, tax4_applies
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
            RETURNING *`,
            [
                userId, code, name, product_type, price, cost, gl_account_id || null,
                !!is_sales_item, !!is_purchase_item, !!is_service_item,
                tax1_name, !!tax1_applies, tax2_name, !!tax2_applies,
                tax3_name, !!tax3_applies, tax4_name, !!tax4_applies
            ]
=======
        const userId = req.user.id;
        const { code, name, product_type, price, cost, account_name, sub_account, tax_account, tax1_name, tax1_applies, tax2_name, tax2_applies, tax3_name, tax3_applies, tax4_name, tax4_applies } = req.body;

        const newProduct = await db.query(
            `INSERT INTO products (user_id, code, name, product_type, price, cost, account_name, sub_account, tax_account, tax1_name, tax1_applies, tax2_name, tax2_applies, tax3_name, tax3_applies, tax4_name, tax4_applies) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
            [userId, code, name, product_type, price, cost, account_name, sub_account, tax_account, tax1_name, tax1_applies, tax2_name, tax2_applies, tax3_name, tax3_applies, tax4_name, tax4_applies]
>>>>>>> 73caa98416f2e1c2d5ca1d2daec3e98380901cf1
        );
        res.status(201).json(newProduct.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const updateProduct = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { id } = req.params;
<<<<<<< HEAD
        const {
            code, name, product_type, price, cost, gl_account_id,
            is_sales_item, is_purchase_item, is_service_item,
            tax1_name, tax1_applies, tax2_name, tax2_applies,
            tax3_name, tax3_applies, tax4_name, tax4_applies
        } = req.body;

        const updatedProduct = await db.query(
            `UPDATE products SET 
                code = $1, name = $2, product_type = $3, price = $4, cost = $5, gl_account_id = $6, 
                is_sales_item = $7, is_purchase_item = $8, is_service_item = $9, 
                tax1_name = $10, tax1_applies = $11, tax2_name = $12, tax2_applies = $13, 
                tax3_name = $14, tax3_applies = $15, tax4_name = $16, tax4_applies = $17 
             WHERE product_id = $18 AND user_id = $19 RETURNING *`,
            [
                code, name, product_type, price, cost, gl_account_id || null,
                !!is_sales_item, !!is_purchase_item, !!is_service_item,
                tax1_name, !!tax1_applies, tax2_name, !!tax2_applies,
                tax3_name, !!tax3_applies, tax4_name, !!tax4_applies,
                id, userId
            ]
=======
        const { code, name, product_type, price, cost, account_name, sub_account, tax_account, tax1_name, tax1_applies, tax2_name, tax2_applies, tax3_name, tax3_applies, tax4_name, tax4_applies } = req.body;

        const updatedProduct = await db.query(
            `UPDATE products SET code = $1, name = $2, product_type = $3, price = $4, cost = $5, account_name = $6, sub_account = $7, tax_account = $8, tax1_name = $9, tax1_applies = $10, tax2_name = $11, tax2_applies = $12, tax3_name = $13, tax3_applies = $14, tax4_name = $15, tax4_applies = $16  WHERE product_id = $17 AND user_id = $18 RETURNING *`,
            [code, name, product_type, price, cost, account_name, sub_account, tax_account, tax1_name, tax1_applies, tax2_name, tax2_applies, tax3_name, tax3_applies, tax4_name, tax4_applies, id, userId]
>>>>>>> 73caa98416f2e1c2d5ca1d2daec3e98380901cf1
        );
        if (updatedProduct.rows.length === 0) return res.status(404).json({ msg: 'Producto no encontrado.' });
        res.json(updatedProduct.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const deleteProduct = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { id } = req.params;
        const deletedProduct = await db.query('DELETE FROM products WHERE product_id = $1 AND user_id = $2', [id, userId]);
        if (deletedProduct.rowCount === 0) {
            return res.status(404).json({ msg: 'Producto no encontrado.' });
        }
        res.json({ msg: 'Producto eliminado correctamente.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

module.exports = { getProducts, createProduct, updateProduct, deleteProduct };