import pkg from 'pg';
const { Client } = pkg;

const targetUrl = 'postgresql://postgres:TrimecSecureDBPassword2026!@db.mhcikqbggxqasspuzbto.supabase.co:5432/postgres';

const client = new Client({
  connectionString: targetUrl,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    console.log('Probando conexión a Supabase...');
    await client.connect();
    console.log('¡Conexión exitosa!');
    
    const res = await client.query('SELECT id, nombre, email, password_hash, rol FROM usuarios');
    console.log('Usuarios en la base de datos:', res.rows);
  } catch (err) {
    console.error('ERROR CONEXION:', err);
  } finally {
    await client.end();
  }
}

test();
