const PDFDocument = require('pdfkit');

function createGeneralLedgerPdf(dataCallback, endCallback, reportData, profile) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.on('data', dataCallback);
    doc.on('end', endCallback);

    // Encabezado
    doc.fontSize(16).font('Helvetica-Bold').text(profile.company_name || 'Mi Empresa', { align: 'center' });
    doc.fontSize(13).font('Helvetica').text('Libro Mayor General', { align: 'center' });
    doc.fontSize(10).text(`Cuenta: ${reportData.accountName}`, { align: 'center' });
    doc.moveDown(2);

    // Tabla
    const tableTop = 130;
    const dateX = 40;
    const descX = 120;
    const debitX = 350;
    const creditX = 420;
    const balanceX = 490;

    // Cabeceras
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Fecha', dateX, tableTop);
    doc.text('Descripción', descX, tableTop);
    doc.text('Débito', debitX, tableTop, { width: 60, align: 'right' });
    doc.text('Crédito', creditX, tableTop, { width: 60, align: 'right' });
    doc.text('Saldo', balanceX, tableTop, { width: 70, align: 'right' });
    doc.rect(dateX, tableTop + 15, 530, 0.5).fill('#000');

    // Fila Saldo Inicial
    let y = tableTop + 30;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Saldo Inicial', descX, y);
    doc.text(`$${reportData.openingBalance.toFixed(2)}`, balanceX, y, { width: 70, align: 'right' });

    // Filas de Transacciones
    doc.font('Helvetica');
    reportData.transactions.forEach(t => {
        y += 18;
        doc.text(new Date(t.entry_date).toLocaleDateString(), dateX, y);
        doc.text(t.description, descX, y, { width: 220, ellipsis: true });
        doc.text(t.line_type === 'Debito' ? `$${parseFloat(t.amount).toFixed(2)}` : '', debitX, y, { width: 60, align: 'right' });
        doc.text(t.line_type === 'Credito' ? `$${parseFloat(t.amount).toFixed(2)}` : '', creditX, y, { width: 60, align: 'right' });
        doc.text(`$${t.runningBalance.toFixed(2)}`, balanceX, y, { width: 70, align: 'right' });
    });

    // Fila Saldo Final
    y += 25;
    doc.font('Helvetica-Bold');
    doc.rect(dateX, y - 5, 530, 0.5).fill('#000');
    doc.text('Saldo Final', descX, y);
    doc.text(`$${reportData.closingBalance.toFixed(2)}`, balanceX, y, { width: 70, align: 'right' });

    doc.end();
}

module.exports = { createGeneralLedgerPdf };