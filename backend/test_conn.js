import 'dotenv/config';
import dns from 'dns';
import pkg from 'pg';
const { Client } = pkg;

// Configurar resolución de nombres
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const connectionStrings = [
  process.env.DATABASE_URL,
  'postgresql://postgres:TrimecSecureDBPassword2026!@db.mhcikqbggxqasspuzbto.supabase.co:5432/postgres',
  'postgresql://postgres.mhcikqbggxqasspuzbto:TrimecSecureDBPassword2026!@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.mhcikqbggxqasspuzbto:TrimecSecureDBPassword2026!@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
  'postgresql://postgres.mhcikqbggxqasspuzbto:TrimecSecureDBPassword2026!@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.mhcikqbggxqasspuzbto:TrimecSecureDBPassword2026!@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
];

async function testConnections() {
  for (const url of connectionStrings) {
    if (!url) continue;
    console.log(`\nProbando conexión: ${url.replace(/:[^:@]+@/, ':***@')}`);
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });

    try {
      await client.connect();
      console.log('¡CONEXIÓN EXITOSA!');
      const res = await client.query('SELECT count(*) FROM usuarios');
      console.log('Total usuarios:', res.rows[0].count);
      await client.end();
      return url;
    } catch (err) {
      console.error('Error de conexión:', err.message);
      await client.end().catch(() => {});
    }
  }
}

testConnections();

