// server/config/db.js

const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString,
    // Si estás desplegando en un servicio que requiere SSL, descomenta la siguiente línea
    // ssl: { rejectUnauthorized: false }
});

module.exports = pool;
