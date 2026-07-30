import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'trimec.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  console.log('Connected to local SQLite database.');
});

db.all('SELECT id, cliente_id, detalle, estado, monto_neto_presupuesto, hh_presupuestadas FROM ordenes_trabajo', [], (err, rows) => {
  if (err) {
    console.error('Query error:', err);
  } else {
    console.log('OTs in local SQLite database:');
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});
