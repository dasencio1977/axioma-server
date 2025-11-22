const PDFDocument = require('pdfkit');

function createPlReportPdf(dataCallback, endCallback, reportData, profile) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', dataCallback);
    doc.on('end', endCallback);

    // Encabezado
    doc.fontSize(18).text(profile.company_name || 'Mi Empresa', { align: 'center' });
    doc.fontSize(14).text('Reporte de Ganancias y Pérdidas', { align: 'center' });
    const dateRange = `Del ${new Date(reportData.startDate).toLocaleDateString()} al ${new Date(reportData.endDate).toLocaleDateString()}`;
    doc.fontSize(10).text(dateRange, { align: 'center' });
    doc.moveDown(3);

    // Contenido
    doc.fontSize(12).font('Helvetica-Bold').text('Ingresos Totales:', 50, 150);
    doc.font('Helvetica').text(`$${reportData.totalIncome.toFixed(2)}`, { align: 'right' });
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Gastos Totales:', 50);
    doc.font('Helvetica').text(`($${reportData.totalExpenses.toFixed(2)})`, { align: 'right' });
    doc.moveDown(2);

    // Línea divisoria
    doc.rect(50, doc.y, 500, 1).fill('#000');
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').text('Ganancia Neta:', 50);
    doc.font('Helvetica-Bold').text(`$${reportData.netProfit.toFixed(2)}`, { align: 'right' });

    doc.end();
}

module.exports = { createPlReportPdf };