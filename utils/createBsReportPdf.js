const PDFDocument = require('pdfkit');

function createBsReportPdf(dataCallback, endCallback, reportData, profile, asOfDate) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', dataCallback);
    doc.on('end', endCallback);

    // Encabezado
    doc.fontSize(18).text(profile.company_name || 'Mi Empresa', { align: 'center' });
    doc.fontSize(14).text('Balance General', { align: 'center' });
    doc.fontSize(10).text(`Al ${new Date(asOfDate).toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Función de ayuda para dibujar una sección
    function drawSection(title, items, startY) {
        doc.fontSize(12).font('Helvetica-Bold').text(title, 50, startY);
        let y = startY + 20;
        for (const item of items) {
            doc.fontSize(10).font('Helvetica').text(item.name, 70, y, { width: 300 });
            doc.text(`$${item.balance.toFixed(2)}`, 400, y, { width: 150, align: 'right' });
            y += 20;
        }
        return y;
    }

    let currentY = 150;
    // Dibujar secciones
    currentY = drawSection('Activos', reportData.assets, currentY);
    doc.fontSize(12).font('Helvetica-Bold').text('Total Activos', 70, currentY).text(`$${reportData.totalAssets.toFixed(2)}`, { align: 'right' });
    currentY += 40;

    currentY = drawSection('Pasivos', reportData.liabilities, currentY);
    currentY = drawSection('Patrimonio', reportData.equity, currentY + 20); // Damos espacio extra
    doc.fontSize(12).font('Helvetica-Bold').text('Total Pasivos + Patrimonio', 70, currentY).text(`$${reportData.totalLiabilitiesAndEquity.toFixed(2)}`, { align: 'right' });

    doc.end();
}
module.exports = { createBsReportPdf };