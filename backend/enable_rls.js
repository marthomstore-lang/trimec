import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

const targetUrl = process.env.DATABASE_URL;

if (!targetUrl) {
  console.error('ERROR: Por favor establece la variable de entorno DATABASE_URL en el archivo .env o en el entorno.');
  process.exit(1);
}

const pgClient = new Client({
  connectionString: targetUrl,
  ssl: { rejectUnauthorized: false }
});

async function enableRls() {
  try {
    console.log('Conectando a la base de datos PostgreSQL (Supabase) para habilitar RLS...');
    await pgClient.connect();

    // Obtener dinámicamente todas las tablas del esquema 'public'
    const res = await pgClient.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    const knownTables = [
      'usuarios',
      'clientes',
      'trabajadores',
      'ordenes_trabajo',
      'registro_hh',
      'gastos_diarios',
      'facturacion',
      'gastos_generales',
      'archivos_ot'
    ];

    const tablesFound = res.rows.map(r => r.tablename);
    // Combinar tablas detectadas en DB con la lista conocida por si alguna aún no existe o falta
    const tablesToProcess = Array.from(new Set([...tablesFound, ...knownTables]));

    console.log(`Tablas encontradas a procesar: ${tablesToProcess.join(', ')}\n`);

    for (const table of tablesToProcess) {
      try {
        console.log(`Habilitando RLS para la tabla: ${table}...`);
        await pgClient.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
        console.log(`✓ RLS habilitado en ${table}`);
      } catch (err) {
        console.warn(`⚠️ Advertencia al habilitar RLS en ${table}: ${err.message}`);
      }
    }

    console.log('\n--- VERIFICACIÓN DE ESTADO RLS EN SUPABASE ---');
    const verifyRes = await pgClient.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    console.table(verifyRes.rows);
    console.log('\n¡Toda la seguridad RLS ha sido activada con éxito en Supabase!');
  } catch (error) {
    console.error('Error al activar RLS:', error);
  } finally {
    await pgClient.end();
  }
}

enableRls();

