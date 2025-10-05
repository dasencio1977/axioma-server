// server/utils/createCashFlowPdf.js
const PDFDocument = require('pdfkit');

function createCashFlowPdf(dataCallback, endCallback, reportData, profile) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', dataCallback);
    doc.on('end', endCallback);

    // Encabezado
    doc.fontSize(18).text(profile.company_name || 'Mi Empresa', { align: 'center' });
    doc.fontSize(14).text('Estado de Flujo de Caja', { align: 'center' });
    const dateRange = `Del ${new Date(reportData.startDate).toLocaleDateString()} al ${new Date(reportData.endDate).toLocaleDateString()}`;
    doc.fontSize(10).text(dateRange, { align: 'center' });
    doc.moveDown(3);

    // Contenido
    doc.fontSize(12).font('Helvetica-Bold').text('Actividades de Operación');
    doc.moveDown();

    doc.font('Helvetica').text('Entradas de Efectivo (Cobros a Clientes)', 50);
    doc.text(`$${reportData.operatingActivities.inflows.toFixed(2)}`, { align: 'right' });
    doc.moveDown();

    doc.text('Salidas de Efectivo (Pagos y Gastos)', 50);
    doc.text(`($${reportData.operatingActivities.outflows.toFixed(2)})`, { align: 'right' });
    doc.moveDown(2);

    doc.rect(50, doc.y, 500, 1).fill('#000');
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').text('Flujo de Caja Neto de Operaciones:', 50);
    doc.font('Helvetica-Bold').text(`$${reportData.operatingActivities.net.toFixed(2)}`, { align: 'right' });

    doc.end();
}

module.exports = { createCashFlowPdf };