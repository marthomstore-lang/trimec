import { query, get } from './db.js';

async function test() {
  try {
    const currentMonth = new Date().toISOString().substring(0, 7); // ej: "2026-07"
    console.log('Current Month:', currentMonth);
    const workers = await query('SELECT * FROM trabajadores ORDER BY nombre ASC');
    console.log('Workers count:', workers.length);
    
    for (const w of workers) {
      console.log('Testing worker:', w.nombre, '(ID:', w.id, ')');
      // Horas totales del mes
      const hoursSummary = await get(`
        SELECT SUM(horas_normales + horas_extra) as total_horas 
        FROM registro_hh 
        WHERE trabajador_id = ? AND STRFTIME('%Y-%m', fecha) = ?
      `, [w.id, currentMonth]);
      
      console.log('Hours summary:', hoursSummary);

      // Desglose de horas por OT
      const breakdown = await query(`
        SELECT r.ot_id, o.detalle as ot_detalle, SUM(r.horas_normales + r.horas_extra) as horas_ot
        FROM registro_hh r
        JOIN ordenes_trabajo o ON r.ot_id = o.id
        WHERE r.trabajador_id = ? AND STRFTIME('%Y-%m', r.fecha) = ?
        GROUP BY r.ot_id, o.detalle
      `, [w.id, currentMonth]);
      
      console.log('Breakdown count:', breakdown.length);
    }
    console.log('Success!');
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
