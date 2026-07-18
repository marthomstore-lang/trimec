import pkg from 'pg';
const { Client } = pkg;

const targetUrl = process.env.DATABASE_URL;

if (!targetUrl) {
  console.error('ERROR: Por favor establece la variable de entorno DATABASE_URL.');
  process.exit(1);
}

const pgClient = new Client({
  connectionString: targetUrl,
  ssl: { rejectUnauthorized: false }
});

async function enableRls() {
  try {
    console.log('Conectando a Supabase para habilitar RLS...');
    await pgClient.connect();

    const tables = [
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

    for (const table of tables) {
      console.log(`Habilitando RLS para la tabla: ${table}...`);
      await pgClient.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      console.log(`✓ RLS habilitado en ${table}`);
    }

    console.log('¡Toda la seguridad RLS ha sido activada con éxito en Supabase!');
  } catch (error) {
    console.error('Error al activar RLS:', error);
  } finally {
    await pgClient.end();
  }
}

enableRls();
