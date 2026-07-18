import PDFDocument from 'pdfkit';

export const generateBudgetPDF = (ot, client, items, res) => {
  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

  // Pipe to response
  doc.pipe(res);

  // Colors
  const primaryColor = '#003366';
  const secondaryColor = '#333333';
  const accentColor = '#666666';

  // --- HEADER ---
  doc
    .fillColor(primaryColor)
    .fontSize(22)
    .text('TRIMEC SpA', 50, 50, { bold: true })
    .fontSize(10)
    .fillColor(secondaryColor)
    .text('Maestranza y Servicios Metalmecánicos', 50, 75)
    .text('Rut: 76.890.123-K', 50, 90)
    .text('Dirección: Parque Industrial Chillán, Chile', 50, 105)
    .text('Contacto: contacto@trimec.cl | +56 9 8765 4321', 50, 120);

  // Title Box
  doc
    .rect(380, 50, 180, 80)
    .fillColor('#F4F4F4')
    .fill()
    .strokeColor(primaryColor)
    .lineWidth(2)
    .stroke();

  doc
    .fillColor(primaryColor)
    .fontSize(12)
    .text('PRESUPUESTO', 390, 60, { align: 'center', width: 160 })
    .fontSize(14)
    .text(`N° OT: ${ot.id}`, 390, 80, { align: 'center', width: 160 })
    .fontSize(10)
    .fillColor(secondaryColor)
    .text(`Fecha: ${ot.fecha_solicitud || 'N/A'}`, 390, 105, { align: 'center', width: 160 });

  doc.moveDown(4);

  // --- CLIENT INFO ---
  doc
    .fillColor(primaryColor)
    .fontSize(12)
    .text('INFORMACIÓN DEL CLIENTE', 50, 160, { underline: true });

  const clientY = 180;
  doc
    .fillColor(secondaryColor)
    .fontSize(10)
    .text('Razón Social:', 50, clientY, { bold: true })
    .text(client.razon_social, 130, clientY)
    .text('RUT:', 50, clientY + 15, { bold: true })
    .text(client.rut, 130, clientY + 15)
    .text('Contacto:', 50, clientY + 30, { bold: true })
    .text(client.contacto_nombre || 'N/A', 130, clientY + 30)
    .text('Email:', 300, clientY, { bold: true })
    .text(client.contacto_email || 'N/A', 360, clientY)
    .text('Teléfono:', 300, clientY + 15, { bold: true })
    .text(client.contacto_telefono || 'N/A', 360, clientY + 15)
    .text('Tipo Servicio:', 300, clientY + 30, { bold: true })
    .text(ot.es_emergencia ? 'EMERGENCIA (Recargo Aplicado)' : 'Estándar / Planificado', 380, clientY + 30);

  // Line separator
  doc
    .moveTo(50, 235)
    .lineTo(560, 235)
    .strokeColor('#CCCCCC')
    .lineWidth(1)
    .stroke();

  // --- ITEMS TABLE ---
  doc
    .fillColor(primaryColor)
    .fontSize(12)
    .text('DETALLE DEL SERVICIO / COTIZACIÓN', 50, 255);

  const tableTop = 280;
  // Table Header
  doc
    .rect(50, tableTop, 510, 20)
    .fill(primaryColor);

  doc
    .fillColor('#FFFFFF')
    .fontSize(9)
    .text('Descripción del Item / Trabajo Realizado', 60, tableTop + 6, { width: 330 })
    .text('Cantidad', 400, tableTop + 6, { width: 60, align: 'right' })
    .text('Total Neto', 470, tableTop + 6, { width: 80, align: 'right' });

  let currentY = tableTop + 20;

  // Render items
  if (items && items.length > 0) {
    items.forEach((item, index) => {
      // Alternating background colors
      if (index % 2 === 0) {
        doc
          .rect(50, currentY, 510, 20)
          .fill('#F9F9F9')
          .fill();
      }

      doc
        .fillColor(secondaryColor)
        .fontSize(9)
        .text(item.detalle, 60, currentY + 6, { width: 330 })
        .text(item.cantidad.toString(), 400, currentY + 6, { width: 60, align: 'right' })
        .text(`$${Math.round(item.valor_total).toLocaleString('es-CL')}`, 470, currentY + 6, { width: 80, align: 'right' });

      currentY += 20;
    });
  } else {
    // If no items, render single description row representing the OT detail
    doc
      .rect(50, currentY, 510, 25)
      .fill('#F9F9F9')
      .fill();

    doc
      .fillColor(secondaryColor)
      .fontSize(9)
      .text(ot.detalle, 60, currentY + 8, { width: 330 })
      .text('1', 400, currentY + 8, { width: 60, align: 'right' })
      .text(`$${Math.round(ot.monto_neto_presupuesto).toLocaleString('es-CL')}`, 470, currentY + 8, { width: 80, align: 'right' });

    currentY += 25;
  }

  // --- TOTALS ---
  const totalY = currentY + 15;
  const neto = ot.monto_neto_presupuesto || 0;
  const iva = neto * 0.19;
  const total = neto + iva;

  doc
    .fillColor(secondaryColor)
    .fontSize(10)
    .text('Subtotal Neto:', 380, totalY)
    .text(`$${Math.round(neto).toLocaleString('es-CL')}`, 470, totalY, { width: 80, align: 'right' })
    .text('IVA (19%):', 380, totalY + 15)
    .text(`$${Math.round(iva).toLocaleString('es-CL')}`, 470, totalY + 15, { width: 80, align: 'right' })
    .fontSize(12)
    .fillColor(primaryColor)
    .text('TOTAL GENERAL:', 380, totalY + 35, { bold: true })
    .text(`$${Math.round(total).toLocaleString('es-CL')}`, 470, totalY + 35, { width: 80, align: 'right', bold: true });

  // --- TERMS & CONDITIONS ---
  const footerY = 630;
  doc
    .moveTo(50, footerY - 10)
    .lineTo(560, footerY - 10)
    .strokeColor('#CCCCCC')
    .lineWidth(1)
    .stroke();

  doc
    .fillColor(accentColor)
    .fontSize(8)
    .text('Condiciones Comerciales:', 50, footerY, { bold: true })
    .text('- Precios en Pesos Chilenos (CLP).', 50, footerY + 12)
    .text('- Forma de pago: Contra presentación de factura (HES aprobada).', 50, footerY + 22)
    .text('- Validez del presupuesto: 15 días.', 50, footerY + 32)
    .text('- En caso de aprobación, favor enviar Orden de Compra (OC).', 50, footerY + 42);

  // Footer stamp
  doc
    .fillColor(primaryColor)
    .fontSize(9)
    .text('TRIMEC SpA - Departamento de Administración', 300, footerY + 30, { align: 'right', width: 250 });

  doc.end();
};
