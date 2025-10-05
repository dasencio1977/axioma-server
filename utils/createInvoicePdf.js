// server/utils/createInvoicePdf.js
const PDFDocument = require('pdfkit');

function createInvoicePdf(dataCallback, endCallback, invoice, profile) {
    // Creamos un nuevo documento PDF.
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Pipe its output to a custom stream processor that will collect the data.
    doc.on('data', dataCallback);
    doc.on('end', endCallback);

    // --- DISEÑO DEL DOCUMENTO ---

    // Encabezado con el nombre de la empresa y el título "FACTURA"
    doc.fontSize(20).text(profile.company_name || 'Mi Empresa', 50, 57);
    doc.fontSize(10).text(`Factura #: ${invoice.invoice_number}`, 50, 80);
    doc.fontSize(10).text(`Fecha de Emisión: ${new Date(invoice.issue_date).toLocaleDateString()}`, 50, 100);
    doc.fontSize(10).text(`Fecha de Vencimiento: ${new Date(invoice.due_date).toLocaleDateString()}`, 50, 120);

    doc.fontSize(20).text('FACTURA', 200, 57, { align: 'right' });

    doc.moveDown(3);

    // Información del cliente
    doc.fontSize(12).text('Facturar a:', 50, 160);
    doc.fontSize(10).text(invoice.client_name, 50, 180);
    doc.fontSize(10).text(invoice.client_address || '', 50, 200);

    doc.moveDown(4);

    // Tabla de items
    const tableTop = 250;
    const itemCodeX = 50;
    const descriptionX = 150;
    const quantityX = 350;
    const priceX = 420;
    const totalX = 500;

    // Cabeceras de la tabla
    doc.fontSize(10)
        .text('Código/Servicio', itemCodeX, tableTop)
        .text('Descripción', descriptionX, tableTop)
        .text('Cantidad', quantityX, tableTop)
        .text('Precio Unit.', priceX, tableTop)
        .text('Total', totalX, tableTop, { align: 'right' });

    // Línea divisoria
    doc.rect(50, tableTop + 15, 500, 0.5).fill('#000');

    // Filas de la tabla
    let i = 0;
    for (const item of invoice.items) {
        const y = tableTop + 30 + (i * 20);
        doc.fontSize(10)
            .text(item.item_id, itemCodeX, y)
            .text(item.description, descriptionX, y)
            .text(item.quantity, quantityX, y)
            .text(`$${parseFloat(item.unit_price).toFixed(2)}`, priceX, y)
            .text(`$${parseFloat(item.line_total).toFixed(2)}`, totalX, y, { align: 'right' });
        i++;
    }

    doc.moveDown(5);

    // Total
    const totalY = tableTop + 30 + (invoice.items.length * 20);
    doc.fontSize(12).font('Helvetica-Bold').text(`Total: $${parseFloat(invoice.total_amount).toFixed(2)}`, 400, totalY + 20, { align: 'right' });

    // Finalizamos el PDF. Esto es importante.
    doc.end();
}

module.exports = { createInvoicePdf };