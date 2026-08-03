import PDFDocument from 'pdfkit';

export const generateBudgetPDF = (ot, client, { hhList = [], expensesList = [] }, res) => {
  const doc = new PDFDocument({ margin: 30, size: 'LETTER', autoFirstPage: true });

  // Pipe to response
  doc.pipe(res);

  const black = '#000000';
  const red = '#CC0000';
  const headerBg = '#EAEAEA';
  const borderGray = '#666666';

  let currentY = 25;

  const checkPageOverflow = (needed = 15) => {
    if (currentY + needed > 680) {
      doc.addPage();
      currentY = 40;
      return true;
    }
    return false;
  };

  // --- TOP HEADER ---
  doc.fillColor(black).fontSize(16).text('PRESUPUESTO', 220, 25, { bold: true });
  doc.fontSize(10).text(`N° : OT - ${ot.id}`, 240, 42, { bold: true });

  const fechaText = ot.fecha_solicitud || new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  doc.fontSize(8).text(`FECHA ${fechaText}`, 420, 25);

  doc.fontSize(9).text('Ref:', 240, 60, { bold: true });
  doc.fontSize(9).text(`Servicio: ${ot.detalle || 'Reparación y Mantención Industrial'}`, 320, 60, { bold: true });

  const faenaText = ot.faena ? ot.faena.toUpperCase() : 'FAENA GENERAL.-';
  doc.fillColor(red).fontSize(9).text(faenaText, 320, 75, { bold: true });

  // Draw Logo (Left side)
  doc.fillColor('#003366').fontSize(18).text('TRIMEC', 40, 60, { bold: true });
  doc.fontSize(6).fillColor(black).text('INGENIERIA MECANICA - MANTENIMIENTO INDUSTRIAL', 40, 80);

  // --- ANTECEDENTES (2 COLUMNS BOXES) ---
  currentY = 100;

  // Box 1: Prestador (Datos fijos institucionales de TRIMEC)
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

  // Box 2: Cliente (Datos dinámicos del cliente de la OT)
  doc.rect(310, currentY, 260, 95).strokeColor(borderGray).lineWidth(0.8).stroke();
  doc.fillColor(black).fontSize(8).text('ANTECEDENTES EMPRESA', 315, currentY + 4, { bold: true });
  doc.moveTo(310, currentY + 14).lineTo(570, currentY + 14).stroke();

  const cY = currentY + 18;
  doc.fontSize(7.5)
    .text('Señores', 315, cY).text(`: ${client.razon_social || '-'}`, 370, cY)
    .text('Ciudad', 315, cY + 9).text(`: ${client.ciudad || '-'}`, 370, cY + 9)
    .text('Dirección', 315, cY + 18).text(`: ${client.direccion || '-'}`, 370, cY + 18)
    .text('RUT', 315, cY + 27).text(`: ${client.rut || '-'}`, 370, cY + 27)
    .text('Celular', 315, cY + 36).text(`: ${client.contacto_telefono || '-'}`, 370, cY + 36)
    .text('Atención', 315, cY + 45).text(`: Sr.- ${client.contacto_nombre || '-'}`, 370, cY + 45)
    .text('E-mail', 315, cY + 54).text(`: ${client.contacto_email || '-'}`, 370, cY + 54, { color: 'blue' });

  // --- DETALLE DEL SERVICIO BOX ---
  currentY += 102;
  doc.rect(40, currentY, 530, 30).strokeColor(borderGray).lineWidth(0.8).stroke();
  doc.rect(40, currentY, 530, 12).fill(headerBg);
  doc.fillColor(black).fontSize(8).text('DETALLE DEL SERVICIO', 40, currentY + 2, { align: 'center', width: 530, bold: true });
  doc.fontSize(7.5).text(`1.- ${ot.detalle}`, 45, currentY + 15);

  // --- DETALLE DE TRABAJOS & RESUMEN DE LA OFERTA (SIDE BY SIDE) ---
  currentY += 36;
  const splitY = currentY;
  const boxHeight = 92;

  // Box Left: DETALLE DE TRABAJOS PRESUPUESTADOS
  doc.rect(40, splitY, 280, boxHeight).strokeColor(borderGray).lineWidth(0.8).stroke();
  doc.rect(40, splitY, 280, 12).fill(headerBg);
  doc.fillColor(black).fontSize(8).text('DETALLE DE TRABAJOS PRESUPUESTADOS', 40, splitY + 2, { align: 'center', width: 280, bold: true });
  doc.fontSize(7).text(ot.detalle || '', 45, splitY + 16, { width: 270 });

  // Box Right: RESUMEN DE LA OFERTA TABLE
  doc.rect(335, splitY, 235, boxHeight).strokeColor(borderGray).lineWidth(0.8).stroke();
  doc.rect(335, splitY, 235, 12).fill(headerBg);
  doc.fillColor(black).fontSize(8).text('RESUMEN DE LA OFERTA', 335, splitY + 2, { align: 'center', width: 235, bold: true });

  // Clasificación 100% real de gastos e HH asignados a la OT
  let totalHh = 0;
  hhList.forEach(h => { totalHh += Math.round(h.costo_calculado || 0); });
  if (totalHh === 0 && ot.costo_hh) {
    totalHh = Math.round(ot.costo_hh);
  }

  let totalMateriales = 0;
  let totalInsumos = 0;
  let totalTerceros = 0;

  const materialesList = [];
  const insumosList = [];
  const tercerosList = [];

  expensesList.forEach(e => {
    const v = Math.round(e.valor_neto || 0);
    const cat = (e.clasificacion || '').toUpperCase();
    if (cat.includes('INSUMO')) {
      totalInsumos += v;
      insumosList.push(e);
    } else if (cat.includes('TERCERO') || cat.includes('OTROS') || cat.includes('PEAJE') || cat.includes('COMBUSTIBLE') || cat.includes('ALMUERZO')) {
      totalTerceros += v;
      tercerosList.push(e);
    } else {
      totalMateriales += v;
      materialesList.push(e);
    }
  });

  const subtotalSum = totalHh + totalMateriales + totalInsumos + totalTerceros;
  
  let netoTotal = Math.round(ot.monto_neto_presupuesto || 0);
  let utilidad = 0;

  if (netoTotal > 0) {
    utilidad = Math.max(0, netoTotal - subtotalSum);
  } else {
    utilidad = Math.round(subtotalSum * 0.25);
    netoTotal = subtotalSum + utilidad;
  }

  const iva = Math.round(netoTotal * 0.19);
  const totalG = netoTotal + iva;

  const rY = splitY + 14;
  doc.fontSize(7)
    .text('Mano de Obra', 340, rY).text('$', 415, rY).text(totalHh > 0 ? totalHh.toLocaleString('es-CL') : '-', 480, rY, { align: 'right', width: 80 })
    .text('Repuestos - Materiales', 340, rY + 9).text('$', 415, rY + 9).text(totalMateriales > 0 ? totalMateriales.toLocaleString('es-CL') : '-', 480, rY + 9, { align: 'right', width: 80 })
    .text('Insumos', 340, rY + 18).text('$', 415, rY + 18).text(totalInsumos > 0 ? totalInsumos.toLocaleString('es-CL') : '-', 480, rY + 18, { align: 'right', width: 80 })
    .text('Servicios de terceros', 340, rY + 27).text('$', 415, rY + 27).text(totalTerceros > 0 ? totalTerceros.toLocaleString('es-CL') : '-', 480, rY + 27, { align: 'right', width: 80 })
    .text('Utilidad', 340, rY + 36).text('$', 415, rY + 36).text(utilidad > 0 ? utilidad.toLocaleString('es-CL') : '-', 480, rY + 36, { align: 'right', width: 80 });

  // Highlight Valor Neto row
  doc.rect(335, rY + 45, 235, 10).fill('#D9D9D9');
  doc.fillColor(black).fontSize(7.5)
    .text('Valor Neto', 340, rY + 46, { bold: true })
    .text('$', 415, rY + 46, { bold: true })
    .text(netoTotal.toLocaleString('es-CL'), 480, rY + 46, { align: 'right', width: 80, bold: true });

  doc.fontSize(7)
    .text('Iva', 340, rY + 57).text('$', 415, rY + 57).text(iva.toLocaleString('es-CL'), 480, rY + 57, { align: 'right', width: 80 })
    .text('Total', 340, rY + 66, { bold: true }).text('$', 415, rY + 66, { bold: true }).text(totalG.toLocaleString('es-CL'), 480, rY + 66, { align: 'right', width: 80, bold: true });

  currentY += boxHeight + 14;

  // --- ITEM N°1 - MANO DE OBRA ---
  checkPageOverflow(30);
  doc.rect(40, currentY, 530, 12).fill(headerBg);
  doc.fillColor(black).fontSize(8).text('Item N°1 - MANO DE OBRA', 45, currentY + 2, { bold: true });

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
      checkPageOverflow(12);
      const totHoras = (hh.horas_normales || 0) + (hh.horas_extra || 0);
      const costo = Math.round(hh.costo_calculado || 0);
      const pUnit = totHoras > 0 ? Math.round(costo / totHoras) : 0;
      doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
      doc.fontSize(7)
        .text(hh.actividad || hh.trabajador_rol || hh.trabajador_nombre || 'Mecánico', 45, currentY + 2, { width: 200 })
        .text('1', 250, currentY + 2, { width: 60, align: 'center' })
        .text(totHoras.toString(), 315, currentY + 2, { width: 40, align: 'center' })
        .text(`$ ${pUnit.toLocaleString('es-CL')}`, 360, currentY + 2, { width: 90, align: 'center' })
        .text(`$ ${costo.toLocaleString('es-CL')}`, 460, currentY + 2, { width: 100, align: 'right' });
      currentY += 11;
    });
  } else {
    checkPageOverflow(12);
    doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
    doc.fontSize(7)
      .text('Mano de obra general según requerimiento', 45, currentY + 2, { width: 200 })
      .text('1', 250, currentY + 2, { width: 60, align: 'center' })
      .text((ot.hh_presupuestadas || '-').toString(), 315, currentY + 2, { width: 40, align: 'center' })
      .text('$', 360, currentY + 2, { width: 90, align: 'center' })
      .text(`$ ${totalHh > 0 ? totalHh.toLocaleString('es-CL') : '-'}`, 460, currentY + 2, { width: 100, align: 'right' });
    currentY += 11;
  }

  checkPageOverflow(14);
  doc.fontSize(7.5).text('Total Mano de Obra ($)', 360, currentY + 2, { bold: true }).text(`$ ${totalHh > 0 ? totalHh.toLocaleString('es-CL') : '-'}`, 460, currentY + 2, { align: 'right', width: 100, bold: true });

  // --- ITEM N°2 - REPUESTOS - MATERIALES ---
  currentY += 14;
  checkPageOverflow(30);
  doc.rect(40, currentY, 530, 10).fill(headerBg);
  doc.fillColor(black).fontSize(7.5).text('Item N°2 - REPUESTOS - MATERIALES', 45, currentY + 1, { bold: true });
  currentY += 10;
  doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
  doc.fontSize(7).text('Descripción', 45, currentY + 2).text('Cantidad', 250, currentY + 2, { align: 'center', width: 60 }).text('Unidad', 315, currentY + 2, { align: 'center', width: 40 }).text('Precio Unitario', 360, currentY + 2, { align: 'center', width: 90 }).text('Valor Total ($)', 460, currentY + 2, { align: 'right', width: 100 });
  currentY += 11;

  if (materialesList.length > 0) {
    materialesList.forEach(m => {
      checkPageOverflow(12);
      const cant = m.cantidad || 1;
      const valN = Math.round(m.valor_neto || 0);
      const pUnit = Math.round(valN / cant);
      doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
      doc.fontSize(7)
        .text(m.detalle || 'Materiales', 45, currentY + 2, { width: 200 })
        .text(cant.toString(), 250, currentY + 2, { align: 'center', width: 60 })
        .text('c/u', 315, currentY + 2, { align: 'center', width: 40 })
        .text(`$ ${pUnit.toLocaleString('es-CL')}`, 360, currentY + 2, { align: 'center', width: 90 })
        .text(`$ ${valN.toLocaleString('es-CL')}`, 460, currentY + 2, { align: 'right', width: 100 });
      currentY += 11;
    });
  } else {
    checkPageOverflow(12);
    doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
    doc.fontSize(7).text('-', 45, currentY + 2).text('0', 250, currentY + 2, { align: 'center', width: 60 }).text('c/u', 315, currentY + 2, { align: 'center', width: 40 }).text('$', 360, currentY + 2, { align: 'center', width: 90 }).text('-', 460, currentY + 2, { align: 'right', width: 100 });
    currentY += 11;
  }
  checkPageOverflow(14);
  doc.fontSize(7.5).text('Total Repuestos - Materiales', 360, currentY + 2, { bold: true }).text(`$ ${totalMateriales > 0 ? totalMateriales.toLocaleString('es-CL') : '-'}`, 460, currentY + 2, { align: 'right', width: 100, bold: true });

  // --- ITEM N°3 - INSUMOS ---
  currentY += 14;
  checkPageOverflow(30);
  doc.rect(40, currentY, 530, 10).fill(headerBg);
  doc.fillColor(black).fontSize(7.5).text('Item N°3 - INSUMOS', 45, currentY + 1, { bold: true });
  currentY += 10;
  doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
  doc.fontSize(7).text('Descripción', 45, currentY + 2).text('Cantidad', 250, currentY + 2, { align: 'center', width: 60 }).text('Unidad', 315, currentY + 2, { align: 'center', width: 40 }).text('Precio Unitario', 360, currentY + 2, { align: 'center', width: 90 }).text('Valor Total ($)', 460, currentY + 2, { align: 'right', width: 100 });
  currentY += 11;

  if (insumosList.length > 0) {
    insumosList.forEach(ins => {
      checkPageOverflow(12);
      const cant = ins.cantidad || 1;
      const valN = Math.round(ins.valor_neto || 0);
      const pUnit = Math.round(valN / cant);
      doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
      doc.fontSize(7)
        .text(ins.detalle || 'Insumos', 45, currentY + 2, { width: 200 })
        .text(cant.toString(), 250, currentY + 2, { align: 'center', width: 60 })
        .text('c/u', 315, currentY + 2, { align: 'center', width: 40 })
        .text(`$ ${pUnit.toLocaleString('es-CL')}`, 360, currentY + 2, { align: 'center', width: 90 })
        .text(`$ ${valN.toLocaleString('es-CL')}`, 460, currentY + 2, { align: 'right', width: 100 });
      currentY += 11;
    });
  } else {
    checkPageOverflow(12);
    doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
    doc.fontSize(7).text('-', 45, currentY + 2).text('0', 250, currentY + 2, { align: 'center', width: 60 }).text('c/u', 315, currentY + 2, { align: 'center', width: 40 }).text('$', 360, currentY + 2, { align: 'center', width: 90 }).text('-', 460, currentY + 2, { align: 'right', width: 100 });
    currentY += 11;
  }
  checkPageOverflow(14);
  doc.fontSize(7.5).text('Total Insumos', 360, currentY + 2, { bold: true }).text(`$ ${totalInsumos > 0 ? totalInsumos.toLocaleString('es-CL') : '-'}`, 460, currentY + 2, { align: 'right', width: 100, bold: true });

  // --- ITEM N°4 - SERVICIOS DE TERCEROS ---
  currentY += 14;
  checkPageOverflow(30);
  doc.rect(40, currentY, 530, 10).fill(headerBg);
  doc.fillColor(black).fontSize(7.5).text('Item N°4 - SERVICIOS DE TERCEROS', 45, currentY + 1, { bold: true });
  currentY += 10;
  doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
  doc.fontSize(7).text('Descripción', 45, currentY + 2).text('Cantidad', 250, currentY + 2, { align: 'center', width: 60 }).text('Unidad', 315, currentY + 2, { align: 'center', width: 40 }).text('Precio Unitario', 360, currentY + 2, { align: 'center', width: 90 }).text('Valor Total ($)', 460, currentY + 2, { align: 'right', width: 100 });
  currentY += 11;

  if (tercerosList.length > 0) {
    tercerosList.forEach(t => {
      checkPageOverflow(12);
      const cant = t.cantidad || 1;
      const valN = Math.round(t.valor_neto || 0);
      const pUnit = Math.round(valN / cant);
      doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
      doc.fontSize(7)
        .text(t.detalle || 'Servicio de Terceros', 45, currentY + 2, { width: 200 })
        .text(cant.toString(), 250, currentY + 2, { align: 'center', width: 60 })
        .text('c/u', 315, currentY + 2, { align: 'center', width: 40 })
        .text(`$ ${pUnit.toLocaleString('es-CL')}`, 360, currentY + 2, { align: 'center', width: 90 })
        .text(`$ ${valN.toLocaleString('es-CL')}`, 460, currentY + 2, { align: 'right', width: 100 });
      currentY += 11;
    });
  } else {
    checkPageOverflow(12);
    doc.rect(40, currentY, 530, 11).strokeColor(borderGray).stroke();
    doc.fontSize(7).text('-', 45, currentY + 2).text('0', 250, currentY + 2, { align: 'center', width: 60 }).text('c/u', 315, currentY + 2, { align: 'center', width: 40 }).text('$', 360, currentY + 2, { align: 'center', width: 90 }).text('-', 460, currentY + 2, { align: 'right', width: 100 });
    currentY += 11;
  }
  checkPageOverflow(14);
  doc.fontSize(7.5).text('Total Servicios de Terceros', 360, currentY + 2, { bold: true }).text(`$ ${totalTerceros > 0 ? totalTerceros.toLocaleString('es-CL') : '-'}`, 460, currentY + 2, { align: 'right', width: 100, bold: true });

  // --- BOTTOM: NOTAS & FIRMA ---
  currentY += 18;
  checkPageOverflow(80);

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
  doc.fontSize(6.5);
  customNotesLines.forEach(line => {
    if (!line.trim()) return;
    const lineH = doc.heightOfString(line, { width: 350 });
    if (nY + lineH > 700) {
      doc.addPage();
      nY = 40;
    }
    doc.text(line, 40, nY, { width: 350 });
    nY += lineH + 2;
  });

  // FIRMA Y TIMBRE (Right side)
  let sigY = nY > currentY + 15 ? nY : currentY + 15;
  if (sigY + 60 > 720) {
    doc.addPage();
    sigY = 40;
  }
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
