// server/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    // 1. Obtener el token del encabezado de la solicitud
    const token = req.header('x-auth-token');

    // 2. Verificar si no hay token
    if (!token) {
        return res.status(401).json({ msg: 'No hay token, permiso denegado' });
    }

    // 3. Verificar si el token es válido
    try {
        const decoded = jwt.verify(token, 'tu_secreto_jwt'); // Usa la misma clave secreta

        // 4. Si es válido, añadir el usuario del payload a la solicitud (req)
        req.user = decoded.user;
        next(); // Continuar a la siguiente función (el controlador de la ruta)
    } catch (err) {
        res.status(401).json({ msg: 'El token no es válido' });
    }
};