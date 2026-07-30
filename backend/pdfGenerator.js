import PDFDocument from 'pdfkit';

export const generateBudgetPDF = (ot, client, { hhList = [], expensesList = [] }, res) => {
  const doc = new PDFDocument({ margin: 30, size: 'LETTER' });

  // Pipe to response
  doc.pipe(res);

  const black = '#000000';
  const red = '#CC0000';
  const headerBg = '#EAEAEA';
  const borderGray = '#666666';

  // --- TOP HEADER ---
  // Logo placeholder & Title
  doc.fillColor(black).fontSize(16).text('PRESUPUESTO', 220, 25, { bold: true });
  doc.fontSize(10).text(`N° : OT - ${ot.id}`, 240, 42, { bold: true });

  const fechaText = ot.fecha_solicitud || new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  doc.fontSize(8).text(`FECHA ${fechaText}`, 420, 25);

  doc.fontSize(9).text('Ref:', 240, 60, { bold: true });
  doc.fontSize(9).text(`Servicio: ${ot.detalle || 'Reparación y Mantención Industrial'}`, 320, 60, { bold: true });

  const faenaText = ot.faena ? ot.faena.toUpperCase() : 'FAENA BUCALEMU.-';
  doc.fillColor(red).fontSize(9).text(faenaText, 320, 75, { bold: true });

  // Draw Logo (Left side)
  doc.fillColor('#003366').fontSize(18).text('TRIMEC', 40, 60, { bold: true });
  doc.fontSize(6).fillColor(black).text('INGENIERIA MECANICA - MANTENIMIENTO INDUSTRIAL', 40, 80);

  // --- ANTECEDENTES (2 COLUMNS BOXES) ---
  let currentY = 100;

  // Box 1: Prestador
  doc.rect(40, currentY, 260, 95).strokeColor(borderGray).lineWidth(0.8).stroke();
  doc.fillColor(black).fontSize(8).text('ANTECEDENTES EMPRESA PRESTADORA DE SERVICIO', 45, currentY + 4, { bold: true });
  doc.moveTo(40, currentY + 14).lineTo(300, currentY + 14).stroke();

  const pY = currentY + 18;
  doc.fontSize(7.5)
    .text('RUT', 45, pY).text(': 77.546.806-8', 105, pY)
    .text('Ing. Méc.', 45, pY + 9).text(': Angelo Muñoz V.', 105, pY + 9)
    .text('Contenido', 45, pY + 18).text(': Servicios.-', 105, pY + 18)
    .text('Especialidad', 45, pY + 27).text(': Estructuras Metálicas.-', 105, pY + 27)
    .text('E-Mail', 45, pY + 36).text(': angelo.munoz@trimec-spa.cl', 105, pY + 36, { color: 'blue' })
    .text('Fono', 45, pY + 45).text(': (+569) 3241 5655', 105, pY + 45)
    .text('Dirección', 45, pY + 54).text(': Camino a Ranchillo bajo lote 9, Campanario, Yungay.', 105, pY + 54)
    .text('Ciudad', 45, pY + 63).text(': Chillán.', 105, pY + 63);

  // Box 2: Cliente
  doc.rect(310, currentY, 260, 95).strokeColor(borderGray).lineWidth(0.8).stroke();
  doc.fillColor(black).fontSize(8).text('ANTECEDENTES EMPRESA', 315, currentY + 4, { bold: true });
  doc.moveTo(310, currentY + 14).lineTo(570, currentY + 14).stroke();

  const cY = currentY + 18;
  doc.fontSize(7.5)
    .text('Señores', 315, cY).text(`: ${client.razon_social || 'SERVICIOS FORESTALES Y COMERCIALES'}`, 370, cY)
    .text('Ciudad', 315, cY + 9).text(`: ${client.ciudad || 'Concepción'}`, 370, cY + 9)
    .text('Dirección', 315, cY + 18).text(`: ${client.direccion || 'Callejón Puchacay 286'}`, 370, cY + 18)
    .text('RUT', 315, cY + 27).text(`: ${client.rut || '85.751.100-3'}`, 370, cY + 27)
    .text('Celular', 315, cY + 36).text(`: ${client.contacto_telefono || '(+569) 7459 9864'}`, 370, cY + 36)
    .text('Atención', 315, cY + 45).text(`: Sr.- ${client.contacto_nombre || 'Alvaro Romero.-'}`, 370, cY + 45)
    .text('E-mail', 315, cY + 54).text(`: ${client.contacto_email || 'alvaro.romero@serfocol.cl'}`, 370, cY + 54, { color: 'blue' });

  // --- DETALLE DEL SERVICIO BOX ---
  currentY += 102;
  doc.rect(40, currentY, 530, 30).strokeColor(borderGray).lineWidth(0.8).stroke();
  doc.rect(40, currentY, 530, 12).fill(headerBg);
  doc.fillColor(black).fontSize(8).text('DETALLE DEL SERVICIO', 40, currentY + 2, { align: 'center', width: 530, bold: true });
  doc.fontSize(7.5).text(`1.- ${ot.detalle}`, 45, currentY + 15);

  // --- DETALLE DE TRABAJOS & RESUMEN DE LA OFERTA (SIDE BY SIDE) ---
  currentY += 36;
  const splitY = currentY;

  // Box Left: DETALLE DE TRABAJOS PRESUPUESTADOS
  doc.rect(40, splitY, 280, 75).strokeColor(borderGray).lineWidth(0.8).stroke();
  doc.rect(40, splitY, 280, 12).fill(headerBg);
  doc.fillColor(black).fontSize(8).text('DETALLE DE TRABAJOS PRESUPUESTADOS', 40, splitY + 2, { align: 'center', width: 280, bold: true });

  // Box Right: RESUMEN DE LA OFERTA TABLE
  doc.rect(335, splitY, 235, 75).strokeColor(borderGray).lineWidth(0.8).stroke();
  doc.rect(335, splitY, 235, 12).fill(headerBg);
  doc.fillColor(black).fontSize(8).text('RESUMEN DE LA OFERTA', 335, splitY + 2, { align: 'center', width: 235, bold: true });

  // Categorize totals from lists
  let totalHh = 0;
  hhList.forEach(h => { totalHh += Math.round(h.costo_calculado || 0); });
  if (totalHh === 0) totalHh = Math.round(ot.costo_hh || 143369);

  let totalMateriales = 0;
  let totalInsumos = 0;
  let totalTerceros = 0;

  expensesList.forEach(e => {
    const v = Math.round(e.valor_neto || 0);
    const cat = (e.clasificacion || '').toUpperCase();
    if (cat.includes('INSUMO')) totalInsumos += v;
    else if (cat.includes('TERCERO') || cat.includes('OTROS') || cat.includes('PEAJE') || cat.includes('COMBUSTIBLE')) totalTerceros += v;
    else totalMateriales += v;
  });

  if (expensesList.length === 0) {
    totalInsumos = 6666;
    totalTerceros = 18888;
  }

  const subtotalSum = totalHh + totalMateriales + totalInsumos + totalTerceros;
  const utilidad25 = Math.round(subtotalSum * 0.25);
  const netoTotal = ot.monto_neto_presupuesto || (subtotalSum + utilidad25);
  const iva = Math.round(netoTotal * 0.19);
  const totalG = netoTotal + iva;

  const rY = splitY + 14;
  doc.fontSize(7)
    .text('Mano de Obra', 340, rY).text('$', 415, rY).text(totalHh.toLocaleString('es-CL'), 480, rY, { align: 'right', width: 80 })
    .text('Repuestos - Materiales', 340, rY + 8).text('$', 415, rY + 8).text(totalMateriales > 0 ? totalMateriales.toLocaleString('es-CL') : '-', 480, rY + 8, { align: 'right', width: 80 })
    .text('Insumos', 340, rY + 16).text('$', 415, rY + 16).text(totalInsumos > 0 ? totalInsumos.toLocaleString('es-CL') : '-', 480, rY + 16, { align: 'right', width: 80 })
    .text('Servicios de terceros', 340, rY + 24).text('$', 415, rY + 24).text(totalTerceros > 0 ? totalTerceros.toLocaleString('es-CL') : '-', 480, rY + 24, { align: 'right', width: 80 })
    .text('Utilidad 25%', 340, rY + 32).text('$', 415, rY + 32).text(utilidad25.toLocaleString('es-CL'), 480, rY + 32, { align: 'right', width: 80 });

  // Highlight Valor Neto row
  doc.rect(335, rY + 40, 235, 10).fill('#D9D9D9');
  doc.fillColor(black).fontSize(7.5)
    .text('Valor Neto', 340, rY + 41, { bold: true })
    .text('$', 415, rY + 41, { bold: true })
    .text(netoTotal.toLocaleString('es-CL'), 480, rY + 41, { align: 'right', width: 80, bold: true });

  doc.fontSize(7)
    .text('Iva', 340, rY + 51).text('$', 415, rY + 51).text(iva.toLocaleString('es-CL'), 480, rY + 51, { align: 'right', width: 80 })
    .text('Total', 340, rY + 59, { bold: true }).text('$', 415, rY + 59, { bold: true }).text(totalG.toLocaleString('es-CL'), 480, rY + 59, { align: 'right', width: 80, bold: true });

  // --- ITEM N°1 - MANO DE OBRA ---
  currentY += 82;
  doc.rect(40, currentY, 530, 12).fill(headerBg);
  doc.fillColor(black).fontSize(8).text('Item N°1 - MANO DE OBRA', 45, currentY + 2, { bold: true });

  // Headers
  currentY += 12;
  doc.rect(40, currentY, 530, 12).strokeColor(borderGray).stroke();
  doc.fontSize(7)
    .text('Descripción', 45, currentY + 2, { width: 200 })
    .text('N° Personas', 250, currentY + 2, { width: 60, align: 'center' })
    .text('HH', 315, currentY + 2, { width: 40, align: 'center' })
    .text('Precio Unitario HH', 360, currentY + 2, { width: 90, align: 'center' })
    .text('Valor Total ($)', 460, currentY + 2, { width: 100, align: 'right' });

  currentY += 12;
  if (hhList.length > 0) {
    hhList.forEach(hh => {
      doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
      doc.fontSize(7)
        .text(hh.trabajador_rol || hh.trabajador_nombre || 'Mecánico', 45, currentY + 2)
        .text('1', 250, currentY + 2, { width: 60, align: 'center' })
        .text((hh.horas_normales + hh.horas_extra).toString(), 315, currentY + 2, { width: 40, align: 'center' })
        .text(`$ ${Math.round(hh.costo_calculado / (hh.horas_normales + hh.horas_extra || 1)).toLocaleString('es-CL')}`, 360, currentY + 2, { width: 90, align: 'center' })
        .text(`$ ${Math.round(hh.costo_calculado).toLocaleString('es-CL')}`, 460, currentY + 2, { width: 100, align: 'right' });
      currentY += 11;
    });
  } else {
    // Default demo rows matching image
    doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
    doc.fontSize(7).text('Soldador', 45, currentY + 2).text('1', 250, currentY + 2, { align: 'center', width: 60 }).text('2', 315, currentY + 2, { align: 'center', width: 40 }).text('$ 21.361', 360, currentY + 2, { align: 'center', width: 90 }).text('$ 37.381', 460, currentY + 2, { align: 'right', width: 100 });
    currentY += 11;
    doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
    doc.fontSize(7).text('Mecánico', 45, currentY + 2).text('1', 250, currentY + 2, { align: 'center', width: 60 }).text('2', 315, currentY + 2, { align: 'center', width: 40 }).text('$ 18.021', 360, currentY + 2, { align: 'center', width: 90 }).text('$ 31.538', 460, currentY + 2, { align: 'right', width: 100 });
    currentY += 11;
  }

  // Subsection 1.2 & Viajes
  doc.rect(40, currentY, 530, 10).fill(headerBg);
  doc.fillColor(black).fontSize(7).text('1.2.- Gestión habilitación.', 45, currentY + 1, { bold: true });
  currentY += 10;
  doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
  doc.fontSize(7).text('RR.HH', 45, currentY + 2).text('1', 250, currentY + 2, { align: 'center', width: 60 }).text('c/u', 315, currentY + 2, { align: 'center', width: 40 }).text('$', 360, currentY + 2).text('-', 460, currentY + 2, { align: 'right', width: 100 });

  currentY += 11;
  doc.rect(40, currentY, 530, 10).fill(headerBg);
  doc.fillColor(black).fontSize(7).text('Item - MANO DE OBRA VIAJE', 45, currentY + 1, { bold: true });
  currentY += 10;
  doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
  doc.fontSize(7).text('Viaje Cholguan - Bucalemu', 45, currentY + 2).text('5,5', 250, currentY + 2, { align: 'center', width: 60 }).text('Hh', 315, currentY + 2, { align: 'center', width: 40 }).text('$ 5.500', 360, currentY + 2, { align: 'center', width: 90 }).text('$ 30.250', 460, currentY + 2, { align: 'right', width: 100 });
  currentY += 11;
  doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
  doc.fontSize(7).text('Kilometraje y Peaje Cholguan - Bucalemu', 45, currentY + 2).text('100', 250, currentY + 2, { align: 'center', width: 60 }).text('Km', 315, currentY + 2, { align: 'center', width: 40 }).text('$ 442', 360, currentY + 2, { align: 'center', width: 90 }).text('$ 44.200', 460, currentY + 2, { align: 'right', width: 100 });
  currentY += 11;
  doc.fontSize(7.5).text('Total Mano de Obra ($)', 360, currentY + 2, { bold: true }).text(`$ ${totalHh.toLocaleString('es-CL')}`, 460, currentY + 2, { align: 'right', width: 100, bold: true });

  // --- ITEM N°2 - REPUESTOS - MATERIALES ---
  currentY += 14;
  doc.rect(40, currentY, 530, 10).fill(headerBg);
  doc.fillColor(black).fontSize(7.5).text('Item N°2 - REPUESTOS - MATERIALES', 45, currentY + 1, { bold: true });
  currentY += 10;
  doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
  doc.fontSize(7).text('Descripción', 45, currentY + 2).text('Cantidad', 250, currentY + 2, { align: 'center', width: 60 }).text('Unidad', 315, currentY + 2, { align: 'center', width: 40 }).text('Precio Unitario', 360, currentY + 2, { align: 'center', width: 90 }).text('Valor Total ($)', 460, currentY + 2, { align: 'right', width: 100 });
  currentY += 11;
  doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
  doc.fontSize(7).text('-', 45, currentY + 2).text('0', 250, currentY + 2, { align: 'center', width: 60 }).text('c/u', 315, currentY + 2, { align: 'center', width: 40 }).text('$', 360, currentY + 2, { align: 'center', width: 90 }).text('-', 460, currentY + 2, { align: 'right', width: 100 });
  currentY += 11;
  doc.fontSize(7.5).text('Total Repuestos - Materiales', 360, currentY + 2, { bold: true }).text(`$ ${totalMateriales > 0 ? totalMateriales.toLocaleString('es-CL') : '-'}`, 460, currentY + 2, { align: 'right', width: 100, bold: true });

  // --- ITEM N°3 - INSUMOS ---
  currentY += 14;
  doc.rect(40, currentY, 530, 10).fill(headerBg);
  doc.fillColor(black).fontSize(7.5).text('Item N°3 - INSUMOS', 45, currentY + 1, { bold: true });
  currentY += 10;
  doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
  doc.fontSize(7).text('EPP', 45, currentY + 2).text('2', 250, currentY + 2, { align: 'center', width: 60 }).text('c/u', 315, currentY + 2, { align: 'center', width: 40 }).text('$ 3.333', 360, currentY + 2, { align: 'center', width: 90 }).text('$ 6.666', 460, currentY + 2, { align: 'right', width: 100 });
  currentY += 11;
  doc.fontSize(7.5).text('Total Insumos', 360, currentY + 2, { bold: true }).text(`$ ${totalInsumos.toLocaleString('es-CL')}`, 460, currentY + 2, { align: 'right', width: 100, bold: true });

  // --- ITEM N°4 - SERVICIOS DE TERCEROS ---
  currentY += 14;
  doc.rect(40, currentY, 530, 10).fill(headerBg);
  doc.fillColor(black).fontSize(7.5).text('Item N°4 - SERVICIOS DE TERCEROS', 45, currentY + 1, { bold: true });
  currentY += 10;
  doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
  doc.fontSize(7).text('Gastos generales', 45, currentY + 2).text('2', 250, currentY + 2, { align: 'center', width: 60 }).text('c/u', 315, currentY + 2, { align: 'center', width: 40 }).text('$ 9.444', 360, currentY + 2, { align: 'center', width: 90 }).text('$ 18.888', 460, currentY + 2, { align: 'right', width: 100 });
  currentY += 11;
  doc.fontSize(7.5).text('Total Servicios de Terceros', 360, currentY + 2, { bold: true }).text(`$ ${totalTerceros.toLocaleString('es-CL')}`, 460, currentY + 2, { align: 'right', width: 100, bold: true });

  // --- BOTTOM: NOTAS & FIRMA ---
  currentY += 18;
  if (currentY > 640) {
    doc.addPage();
    currentY = 40;
  }

  doc.fillColor(black).fontSize(8).text('NOTAS:', 40, currentY, { bold: true });

  const defaultNotes = [
    '1.- Solo se aceptará como válida, la cotización enviada en formato PDF',
    '2.- Este presupuesto tiene una validez de cinco días hábiles, posteriores a eso se deberan recotizar Item N° 2 y 3',
    '3.- La aprobación de presupuesto debera venir acompañada de la correspondiente Orden de Compra pedido o solicitud de pedido, según corresponda.',
    '4.- Garantía por 3 meses.',
    '5.- Jornada de trabajo',
    '5.1.- Horario ordinario : Lunes a Jueves de 08:15am a 17:45pm / Viernes 08:15am a 14:00pm.-',
    '5.2.- Horario extraordinario programado con al menos 48 horas de anticipación: Lunes a Jueves de 17:46pm a 08:15am / Viernes 14:01pm, sabi',
    '5.3.- Llamado de emergencia, domingos y festivos, recargo del 100% por sobre la hora normal.-',
    '6.- Se considera llamado de EMERGENCIA, solicitud de atención inmediata y/o durante el presente día en curso.'
  ];

  const customNotesLines = ot.notas_presupuesto ? ot.notas_presupuesto.split('\n') : defaultNotes;

  let nY = currentY + 12;
  customNotesLines.forEach(line => {
    doc.fontSize(6.5).text(line, 40, nY, { width: 350 });
    nY += 9;
  });

  // FIRMA Y TIMBRE (Right side)
  const sigY = currentY + 15;
  doc.strokeColor('blue').lineWidth(1.5);
  doc.moveTo(430, sigY + 20).quadraticCurveTo(460, sigY - 10, 480, sigY + 25).stroke();
  doc.moveTo(450, sigY + 10).quadraticCurveTo(470, sigY + 30, 500, sigY + 5).stroke();

  doc.fillColor(black).fontSize(8)
    .text('Angelo Muñoz V.', 410, sigY + 35, { align: 'center', width: 140, bold: true })
    .fontSize(7)
    .text('77.546.806-8', 410, sigY + 45, { align: 'center', width: 140 })
    .text('Jefe de Maestranza - Trimec SpA.', 410, sigY + 54, { align: 'center', width: 140 });

  doc.end();
};
