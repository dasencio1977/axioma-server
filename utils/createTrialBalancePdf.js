const PDFDocument = require('pdfkit');

function createTrialBalancePdf(dataCallback, endCallback, reportData, profile, asOfDate) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', dataCallback);
    doc.on('end', endCallback);

    // Encabezado
    doc.fontSize(18).text(profile.company_name || 'Mi Empresa', { align: 'center' });
    doc.fontSize(14).text('Balance de Comprobación', { align: 'center' });
    doc.fontSize(10).text(`Al ${new Date(asOfDate).toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Tabla
    const tableTop = 150;
    doc.fontSize(10).font('Helvetica-Bold')
        .text('Nº Cuenta', 50, tableTop)
        .text('Nombre de Cuenta', 150, tableTop)
        .text('Débitos', 350, tableTop, { width: 100, align: 'right' })
        .text('Créditos', 450, tableTop, { width: 100, align: 'right' });

    let i = 0;
    let totalDebits = 0;
    let totalCredits = 0;
    for (const acc of reportData) {
        const y = tableTop + 20 + (i * 15);
        doc.fontSize(9).font('Helvetica')
            .text(acc.account_number, 50, y)
            .text(acc.account_name, 150, y, { width: 200 })
            .text(`$${acc.debit_balance.toFixed(2)}`, 350, y, { width: 100, align: 'right' })
            .text(`$${acc.credit_balance.toFixed(2)}`, 450, y, { width: 100, align: 'right' });
        totalDebits += acc.debit_balance;
        totalCredits += acc.credit_balance;
        i++;
    }
    // Línea de totales
    const totalY = tableTop + 30 + (i * 15);
    doc.fontSize(10).font('Helvetica-Bold')
        .text('TOTALES', 150, totalY, { width: 200 })
        .text(`$${totalDebits.toFixed(2)}`, 350, totalY, { width: 100, align: 'right' })
        .text(`$${totalCredits.toFixed(2)}`, 450, totalY, { width: 100, align: 'right' });

    doc.end();
}

module.exports = { createTrialBalancePdf };