// server/controllers/authController.js

const db = require('../config/db'); // Importamos nuestra conexión a la BD
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- LÓGICA DE REGISTRO ---
const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ msg: 'Por favor, incluye todos los campos' });
        }

        // Verificar si el usuario ya existe en la BD
        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ msg: 'El correo electrónico ya está registrado' });
        }

        // Encriptar la contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Guardar el nuevo usuario en la BD
        const newUser = await db.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
            [username, email, passwordHash]
        );
        const userId = newUser.rows[0].user_id;

        // Crear y firmar un token JWT
        const payload = { user: { id: userId } };
        jwt.sign(
            payload,
            'tu_secreto_jwt', // ¡Deberías guardar esto en un archivo .env!
            { expiresIn: '5h' },
            (err, token) => {
                if (err) throw err;
                res.status(201).json({ token });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

// --- LÓGICA DE LOGIN ---
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ msg: 'Por favor, incluye todos los campos' });
        }

        // Verificar si el usuario existe
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(400).json({ msg: 'Credenciales inválidas' });
        }
        const user = result.rows[0];

        // Comparar contraseñas
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Credenciales inválidas' });
        }

        // Si todo es correcto, crear y devolver el token
        const payload = { user: { id: user.user_id } };
        jwt.sign(
            payload,
            'tu_secreto_jwt',
            { expiresIn: '5h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
};

module.exports = {
    registerUser,
    loginUser,
};