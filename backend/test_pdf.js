import pkg from 'pg';
import { generateBudgetPDF } from '../api/pdfGenerator.js';
import fs from 'fs';

const { Client } = pkg;
const targetUrl = 'postgresql://postgres:TrimecSecureDBPassword2026!@db.mhcikqbggxqasspuzbto.supabase.co:5432/postgres';

const client = new Client({
  connectionString: targetUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT o.*, c.razon_social, c.rut, c.contacto_nombre, c.contacto_email, c.contacto_telefono 
      FROM ordenes_trabajo o 
      JOIN clientes c ON o.cliente_id = c.id
      WHERE o.id = 'ARA-702'
    `);
    const ot = res.rows[0];
    if (!ot) {
      console.log('OT not found');
      return;
    }
    const clientData = {
      razon_social: ot.razon_social,
      rut: ot.rut,
      contacto_nombre: ot.contacto_nombre,
      contacto_email: ot.contacto_email,
      contacto_telefono: ot.contacto_telefono
    };

    const itemsRes = await client.query('SELECT detalle, cantidad, valor_neto as valor_total FROM gastos_diarios WHERE ot_id = $1 AND clasificacion != \'Almuerzo\'', [ot.id]);
    const items = itemsRes.rows;

    const outStream = fs.createWriteStream('./test.pdf');
    
    console.log('Generating PDF...');
    generateBudgetPDF(ot, clientData, items, outStream);
    console.log('PDF generated successfully!');
  } catch (err) {
    console.error('ERROR GENERATING PDF:', err);
  } finally {
    await client.end();
  }
}

run();
