// server/controllers/profileController.js
const db = require('../config/db');

const getProfile = async (req, res) => {
    try {
        const profile = await db.query('SELECT * FROM profiles WHERE user_id = $1', [req.user.id]);
        if (profile.rows.length === 0) {
            return res.json({});
        }
        res.json(profile.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

const upsertProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            company_name, email, phone, ein, corporation_id, merchant_id,
            address_1, address_2, address_3, city, state, country, zip_code,
            is_postal_same_as_physical, postal_address_1, postal_address_2, postal_address_3,
            postal_city, postal_state, postal_country, postal_zip_code,
            fiscal_year_start, base_currency, incorporation_date,
            default_accounts_receivable, default_sales_income, default_accounts_payable, default_cost_of_goods_sold
        } = req.body;

        const query = `
            INSERT INTO profiles (
                user_id, company_name, email, phone, ein, corporation_id, merchant_id,
                address_1, address_2, address_3, city, state, country, zip_code,
                is_postal_same_as_physical, postal_address_1, postal_address_2, postal_address_3,
                postal_city, postal_state, postal_country, postal_zip_code,
                fiscal_year_start, base_currency, incorporation_date,
                default_accounts_receivable, default_sales_income, default_accounts_payable, default_cost_of_goods_sold
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
            ON CONFLICT (user_id)
            DO UPDATE SET
                company_name = EXCLUDED.company_name, email = EXCLUDED.email, phone = EXCLUDED.phone, ein = EXCLUDED.ein,
                corporation_id = EXCLUDED.corporation_id, merchant_id = EXCLUDED.merchant_id, address_1 = EXCLUDED.address_1,
                address_2 = EXCLUDED.address_2, address_3 = EXCLUDED.address_3, city = EXCLUDED.city, state = EXCLUDED.state,
                country = EXCLUDED.country, zip_code = EXCLUDED.zip_code, is_postal_same_as_physical = EXCLUDED.is_postal_same_as_physical,
                postal_address_1 = EXCLUDED.postal_address_1, postal_address_2 = EXCLUDED.postal_address_2,
                postal_address_3 = EXCLUDED.postal_address_3, postal_city = EXCLUDED.postal_city, postal_state = EXCLUDED.postal_state,
                postal_country = EXCLUDED.postal_country, postal_zip_code = EXCLUDED.postal_zip_code,
                fiscal_year_start = EXCLUDED.fiscal_year_start, base_currency = EXCLUDED.base_currency,
                incorporation_date = EXCLUDED.incorporation_date, default_accounts_receivable = EXCLUDED.default_accounts_receivable,
                default_sales_income = EXCLUDED.default_sales_income, default_accounts_payable = EXCLUDED.default_accounts_payable,
                default_cost_of_goods_sold = EXCLUDED.default_cost_of_goods_sold
            RETURNING *;
        `;
        const values = [
            userId, company_name, email, phone, ein, corporation_id, merchant_id,
            address_1, address_2, address_3, city, state, country, zip_code,
            is_postal_same_as_physical, postal_address_1, postal_address_2, postal_address_3,
            postal_city, postal_state, postal_country, postal_zip_code,
            fiscal_year_start, base_currency, incorporation_date,
            default_accounts_receivable, default_sales_income, default_accounts_payable, default_cost_of_goods_sold
        ];

        const updatedProfile = await db.query(query, values);
        res.json(updatedProfile.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

module.exports = { getProfile, upsertProfile };