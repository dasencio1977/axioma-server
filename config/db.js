// server/config/db.js

const { Pool } = require('pg');

// Reemplaza estos valores con tus propias credenciales de PostgreSQL
const pool = new Pool({
    user: 'postgres',       // Tu usuario de PostgreSQL (por defecto suele ser 'postgres')
    host: 'db.jjuojmmayofkjmaxrqok.supabase.co',
    database: 'postgres', // El nombre de la base de datos que crearemos
    password: 'Y@!n@L!zz#1983', // La contraseña que definiste para PostgreSQL
    port: 5432,
});

module.exports = pool;