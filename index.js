// server/index.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- DEFINIR RUTAS ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/products', require('./routes/products'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/journal-entries', require('./routes/journalEntries'));

// Rutas de Bancos (separadas y claras)
app.use('/api/bank-accounts', require('./routes/bankAccounts'));
app.use('/api/bank-transactions', require('./routes/bankTransactions'));
app.use('/api/reconciliation', require('./routes/reconciliation'));

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});