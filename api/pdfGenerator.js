import PDFDocument from 'pdfkit';

export const generateBudgetPDF = (ot, client, { hhList = [], expensesList = [] }, res) => {
  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });

  // Pipe to response
  doc.pipe(res);

  // Colors
  const primaryColor = '#003366';
  const secondaryColor = '#333333';
  const accentColor = '#666666';
  const tableHeaderBg = '#003366';
  const rowAltBg = '#F8FAFC';

  // --- HEADER ---
  doc
    .fillColor(primaryColor)
    .fontSize(22)
    .text('TRIMEC SpA', 40, 40, { bold: true })
    .fontSize(9)
    .fillColor(secondaryColor)
    .text('Maestranza y Servicios Metalmecánicos', 40, 65)
    .text('Rut: 76.890.123-K', 40, 78)
    .text('Parque Industrial Chillán, Chile', 40, 91)
    .text('Contacto: contacto@trimec.cl | +56 9 8765 4321', 40, 104);

  // Title Box
  doc
    .rect(370, 40, 200, 75)
    .fillColor('#F1F5F9')
    .fill()
    .strokeColor(primaryColor)
    .lineWidth(1.5)
    .stroke();

  doc
    .fillColor(primaryColor)
    .fontSize(13)
    .text('PRESUPUESTO DE TRABAJO', 375, 48, { align: 'center', width: 190 })
    .fontSize(14)
    .text(`N° OT: ${ot.id}`, 375, 66, { align: 'center', width: 190 })
    .fontSize(9)
    .fillColor(secondaryColor)
    .text(`Fecha: ${ot.fecha_solicitud || new Date().toISOString().split('T')[0]}`, 375, 87, { align: 'center', width: 190 })
    .text(`Estado: ${ot.estado || 'SP'}`, 375, 99, { align: 'center', width: 190 });

  // --- CLIENT INFO ---
  doc
    .rect(40, 130, 530, 55)
    .fillColor('#F8FAFC')
    .fill()
    .strokeColor('#CBD5E1')
    .lineWidth(1)
    .stroke();

  doc
    .fillColor(primaryColor)
    .fontSize(10)
    .text('DATOS DEL CLIENTE', 50, 136, { bold: true });

  const clientY = 152;
  doc
    .fillColor(secondaryColor)
    .fontSize(9)
    .text('Razón Social:', 50, clientY)
    .text(client.razon_social || 'Cliente General', 120, clientY, { bold: true })
    .text('RUT:', 50, clientY + 14)
    .text(client.rut || 'N/A', 120, clientY + 14)
    .text('Atención:', 310, clientY)
    .text(client.contacto_nombre || 'N/A', 370, clientY)
    .text('Tel / Email:', 310, clientY + 14)
    .text(`${client.contacto_telefono || ''} ${client.contacto_email ? `| ${client.contacto_email}` : ''}`, 370, clientY + 14);

  // --- OT DETAIL / SCOPE OF WORK ---
  let currentY = 195;
  doc
    .fillColor(primaryColor)
    .fontSize(10)
    .text('DESCRIPCIÓN Y ALCANCE DEL TRABAJO', 40, currentY, { bold: true });

  currentY += 15;
  doc
    .rect(40, currentY, 530, 35)
    .fillColor('#FFFFFF')
    .strokeColor('#E2E8F0')
    .lineWidth(1)
    .stroke();

  doc
    .fillColor(secondaryColor)
    .fontSize(9)
    .text(ot.detalle || 'Servicio de maestranza y reparación general.', 48, currentY + 6, { width: 514 });

  currentY += 45;

  // --- SECTION 1: MANO DE OBRA (HH) ---
  doc
    .fillColor(primaryColor)
    .fontSize(10)
    .text('1. MANO DE OBRA (HORAS HOMBRE - HH)', 40, currentY, { bold: true });

  currentY += 15;

  // Table Header HH
  doc.rect(40, currentY, 530, 18).fill(tableHeaderBg);
  doc
    .fillColor('#FFFFFF')
    .fontSize(8)
    .text('Trabajador / Especialidad', 45, currentY + 5, { width: 170 })
    .text('Actividad / Tarea Realizada', 220, currentY + 5, { width: 190 })
    .text('Horas (N/E)', 415, currentY + 5, { width: 70, align: 'center' })
    .text('Subtotal Neto', 490, currentY + 5, { width: 75, align: 'right' });

  currentY += 18;

  let totalHhNeto = 0;

  if (hhList && hhList.length > 0) {
    hhList.forEach((hh, index) => {
      if (currentY > 680) {
        doc.addPage();
        currentY = 40;
      }
      if (index % 2 === 0) {
        doc.rect(40, currentY, 530, 18).fill(rowAltBg);
      }
      const costoRow = Math.round(hh.costo_calculado || 0);
      totalHhNeto += costoRow;

      doc
        .fillColor(secondaryColor)
        .fontSize(8)
        .text(`${hh.trabajador_nombre || 'Operador'} (${hh.trabajador_rol || 'Taller'})`, 45, currentY + 4, { width: 170 })
        .text(hh.actividad || 'Labores de taller', 220, currentY + 4, { width: 190 })
        .text(`${hh.horas_normales}h / ${hh.horas_extra}h`, 415, currentY + 4, { width: 70, align: 'center' })
        .text(`$${costoRow.toLocaleString('es-CL')}`, 490, currentY + 4, { width: 75, align: 'right' });

      currentY += 18;
    });
  } else {
    // Render summary row from hh_presupuestadas or estimated cost
    const estHh = ot.hh_presupuestadas || 0;
    const estCost = Math.round(ot.costo_hh || 0);
    totalHhNeto = estCost;

    doc.rect(40, currentY, 530, 18).fill(rowAltBg);
    doc
      .fillColor(secondaryColor)
      .fontSize(8)
      .text('Mano de Obra Estimada (HH Presupuestadas)', 45, currentY + 4, { width: 170 })
      .text('Ejecución de trabajos según especificaciones', 220, currentY + 4, { width: 190 })
      .text(`${estHh} hrs`, 415, currentY + 4, { width: 70, align: 'center' })
      .text(`$${estCost.toLocaleString('es-CL')}`, 490, currentY + 4, { width: 75, align: 'right' });

    currentY += 18;
  }

  // --- SECTION 2: MATERIALES, INSUMOS Y SERVICIOS ---
  currentY += 10;
  if (currentY > 650) {
    doc.addPage();
    currentY = 40;
  }

  doc
    .fillColor(primaryColor)
    .fontSize(10)
    .text('2. MATERIALES, INSUMOS Y SERVICIOS DE TERCEROS', 40, currentY, { bold: true });

  currentY += 15;

  // Table Header Materials
  doc.rect(40, currentY, 530, 18).fill(tableHeaderBg);
  doc
    .fillColor('#FFFFFF')
    .fontSize(8)
    .text('Categoría', 45, currentY + 5, { width: 100 })
    .text('Descripción del Item / Insumo', 150, currentY + 5, { width: 260 })
    .text('Cant.', 415, currentY + 5, { width: 70, align: 'center' })
    .text('Valor Neto', 490, currentY + 5, { width: 75, align: 'right' });

  currentY += 18;

  let totalExpensesNeto = 0;

  if (expensesList && expensesList.length > 0) {
    expensesList.forEach((exp, index) => {
      if (currentY > 680) {
        doc.addPage();
        currentY = 40;
      }
      if (index % 2 === 0) {
        doc.rect(40, currentY, 530, 18).fill(rowAltBg);
      }
      const valNeto = Math.round(exp.valor_neto || 0);
      totalExpensesNeto += valNeto;

      doc
        .fillColor(secondaryColor)
        .fontSize(8)
        .text(exp.clasificacion || 'INSUMOS', 45, currentY + 4, { width: 100 })
        .text(exp.detalle || 'Material de trabajo', 150, currentY + 4, { width: 260 })
        .text((exp.cantidad || 1).toString(), 415, currentY + 4, { width: 70, align: 'center' })
        .text(`$${valNeto.toLocaleString('es-CL')}`, 490, currentY + 4, { width: 75, align: 'right' });

      currentY += 18;
    });
  } else {
    // Single summary row for materials
    const matEst = Math.round(ot.costo_gastos || 0);
    totalExpensesNeto = matEst;

    doc.rect(40, currentY, 530, 18).fill(rowAltBg);
    doc
      .fillColor(secondaryColor)
      .fontSize(8)
      .text('MATERIALES', 45, currentY + 4, { width: 100 })
      .text('Insumos, insumos de taller y repuestos necesarios para la OT', 150, currentY + 4, { width: 260 })
      .text('Glb', 415, currentY + 4, { width: 70, align: 'center' })
      .text(`$${matEst.toLocaleString('es-CL')}`, 490, currentY + 4, { width: 75, align: 'right' });

    currentY += 18;
  }

  // --- TOTALS CONSOLIDATED ---
  currentY += 15;
  if (currentY > 630) {
    doc.addPage();
    currentY = 40;
  }

  // Total calculation
  const totalNetoPresupuesto = ot.monto_neto_presupuesto || (totalHhNeto + totalExpensesNeto);
  const iva = totalNetoPresupuesto * 0.19;
  const totalGeneral = totalNetoPresupuesto + iva;

  doc
    .rect(340, currentY, 230, 85)
    .fillColor('#F1F5F9')
    .fill()
    .strokeColor(primaryColor)
    .lineWidth(1)
    .stroke();

  const totalsY = currentY + 8;
  doc
    .fillColor(secondaryColor)
    .fontSize(9)
    .text('Subtotal Mano de Obra (HH):', 350, totalsY)
    .text(`$${Math.round(totalHhNeto).toLocaleString('es-CL')}`, 480, totalsY, { width: 80, align: 'right' })
    .text('Subtotal Materiales e Insumos:', 350, totalsY + 14)
    .text(`$${Math.round(totalExpensesNeto).toLocaleString('es-CL')}`, 480, totalsY + 14, { width: 80, align: 'right' })
    .text('MONTO NETO TOTAL:', 350, totalsY + 30, { bold: true })
    .text(`$${Math.round(totalNetoPresupuesto).toLocaleString('es-CL')}`, 480, totalsY + 30, { width: 80, align: 'right', bold: true })
    .text('IVA (19%):', 350, totalsY + 44)
    .text(`$${Math.round(iva).toLocaleString('es-CL')}`, 480, totalsY + 44, { width: 80, align: 'right' })
    .fontSize(11)
    .fillColor(primaryColor)
    .text('TOTAL GENERAL:', 350, totalsY + 62, { bold: true })
    .text(`$${Math.round(totalGeneral).toLocaleString('es-CL')}`, 480, totalsY + 62, { width: 80, align: 'right', bold: true });

  // --- TERMS & FOOTER ---
  const footerY = 700;
  doc
    .moveTo(40, footerY - 10)
    .lineTo(570, footerY - 10)
    .strokeColor('#CBD5E1')
    .lineWidth(1)
    .stroke();

  doc
    .fillColor(accentColor)
    .fontSize(8)
    .text('Condiciones Comerciales:', 40, footerY, { bold: true })
    .text('• Precios expresados en Pesos Chilenos (CLP) más IVA.', 40, footerY + 11)
    .text('• Forma de pago: Contra entrega / Presentación HES aprobada.', 40, footerY + 21)
    .text('• Validez de la oferta: 15 días corridos a partir de la fecha de emisión.', 40, footerY + 31)
    .text('• Para proceder con el trabajo se requiere HES u Orden de Compra (OC) aprobada.', 40, footerY + 41);

  doc
    .fillColor(primaryColor)
    .fontSize(9)
    .text('TRIMEC SpA - Depto. Operaciones & Finanzas', 320, footerY + 30, { align: 'right', width: 250, bold: true });

  doc.end();
};
