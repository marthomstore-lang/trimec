import sqlite3 from 'sqlite3';
import pkg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'trimec.db');
const targetUrl = process.env.DATABASE_URL;

if (!targetUrl) {
  console.error('ERROR: Por favor establece la variable de entorno DATABASE_URL con tu cadena de conexión de Supabase.');
  process.exit(1);
}

const sqliteDb = new sqlite3.Database(dbPath);
const pgClient = new Client({
  connectionString: targetUrl,
  ssl: { rejectUnauthorized: false }
});

const querySqlite = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function runMigration() {
  try {
    console.log('Conectando a PostgreSQL (Supabase)...');
    await pgClient.connect();
    console.log('¡Conexión a Supabase exitosa!');

    // 1. Inicializar funciones de compatibilidad en Supabase
    console.log('Inicializando funciones de compatibilidad y tablas en Supabase...');
    
    // Crear strftime
    await pgClient.query(`
      CREATE OR REPLACE FUNCTION strftime(format text, val text)
      RETURNS text AS $$
      BEGIN
        IF format = '%Y-%m' THEN
          RETURN TO_CHAR(val::date, 'YYYY-MM');
        ELSIF format = '%Y' THEN
          RETURN TO_CHAR(val::date, 'YYYY');
        ELSE
          RETURN TO_CHAR(val::date, 'YYYY-MM-DD');
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RETURN val;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    await pgClient.query(`
      CREATE OR REPLACE FUNCTION strftime(format text, val date)
      RETURNS text AS $$
      BEGIN
        IF format = '%Y-%m' THEN
          RETURN TO_CHAR(val, 'YYYY-MM');
        ELSE
          RETURN TO_CHAR(val, 'YYYY-MM-DD');
        END IF;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    await pgClient.query(`
      CREATE OR REPLACE FUNCTION strftime(format text, val timestamp)
      RETURNS text AS $$
      BEGIN
        IF format = '%Y-%m' THEN
          RETURN TO_CHAR(val, 'YYYY-MM');
        ELSE
          RETURN TO_CHAR(val, 'YYYY-MM-DD');
        END IF;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    // Crear tablas
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(255) NOT NULL CHECK(rol IN ('admin', 'supervisor', 'contador'))
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        rut VARCHAR(255) NOT NULL UNIQUE,
        razon_social VARCHAR(255) NOT NULL,
        prefijo VARCHAR(255) NOT NULL UNIQUE,
        contacto_nombre VARCHAR(255),
        contacto_email VARCHAR(255),
        contacto_telefono VARCHAR(255)
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS trabajadores (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        rol VARCHAR(255) NOT NULL,
        sueldo_base DOUBLE PRECISION,
        valor_hh_normal DOUBLE PRECISION NOT NULL,
        valor_hh_extra DOUBLE PRECISION NOT NULL,
        horas_mensuales_esperadas DOUBLE PRECISION DEFAULT 180.0
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS ordenes_trabajo (
        id VARCHAR(255) PRIMARY KEY,
        cliente_id INTEGER NOT NULL,
        usuario_id INTEGER,
        detalle TEXT NOT NULL,
        estado VARCHAR(255) NOT NULL CHECK(estado IN ('SP', 'Presupuestada', 'Aprobada', 'En Proceso', 'Terminada', 'Liquidada', 'Facturada')),
        es_emergencia INTEGER NOT NULL DEFAULT 0 CHECK(es_emergencia IN (0, 1)),
        recargo_emergencia DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        fecha_solicitud VARCHAR(255),
        fecha_aprobacion VARCHAR(255),
        fecha_entrega VARCHAR(255),
        monto_neto_presupuesto DOUBLE PRECISION DEFAULT 0.0,
        hh_presupuestadas DOUBLE PRECISION DEFAULT 0.0
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS registro_hh (
        id SERIAL PRIMARY KEY,
        ot_id VARCHAR(255) NOT NULL,
        trabajador_id INTEGER NOT NULL,
        fecha VARCHAR(255) NOT NULL,
        horas_normales DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        horas_extra DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        ubicacion VARCHAR(255) NOT NULL CHECK(ubicacion IN ('Taller', 'Terreno')),
        actividad TEXT
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS gastos_diarios (
        id SERIAL PRIMARY KEY,
        ot_id VARCHAR(255) NOT NULL,
        fecha VARCHAR(255) NOT NULL,
        clasificacion VARCHAR(255) NOT NULL CHECK(clasificacion IN ('INSUMOS', 'Almuerzo', 'Plotteo', 'Peaje', 'Combustible', 'Otros')),
        detalle TEXT NOT NULL,
        cantidad DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        valor_neto DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        valor_iva DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        valor_total DOUBLE PRECISION NOT NULL DEFAULT 0.0
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS facturacion (
        id SERIAL PRIMARY KEY,
        ot_id VARCHAR(255) NOT NULL UNIQUE,
        nro_oc VARCHAR(255),
        fecha_oc VARCHAR(255),
        nro_hes VARCHAR(255),
        nro_factura VARCHAR(255),
        fecha_factura VARCHAR(255),
        estado_pago VARCHAR(255) NOT NULL DEFAULT 'Pendiente' CHECK(estado_pago IN ('Pendiente', 'Pagado', 'Anulado'))
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS gastos_generales (
        id SERIAL PRIMARY KEY,
        fecha VARCHAR(255) NOT NULL,
        familia VARCHAR(255) NOT NULL,
        detalle TEXT NOT NULL,
        valor_total DOUBLE PRECISION NOT NULL DEFAULT 0.0
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS archivos_ot (
        id SERIAL PRIMARY KEY,
        ot_id VARCHAR(255) NOT NULL,
        nombre_original VARCHAR(255) NOT NULL,
        nombre_guardado VARCHAR(255) NOT NULL,
        tipo VARCHAR(255) NOT NULL,
        fecha_subida VARCHAR(255) NOT NULL
      )
    `);

    console.log('Esquema de tablas creado con éxito.');

    // 2. Copiar Datos Tabla por Tabla
    const tables = ['usuarios', 'clientes', 'trabajadores', 'ordenes_trabajo', 'registro_hh', 'gastos_diarios', 'facturacion', 'gastos_generales', 'archivos_ot'];
    
    for (const table of tables) {
      console.log(`Migrando datos de la tabla: ${table}...`);
      const rows = await querySqlite(`SELECT * FROM ${table}`);
      
      if (rows.length === 0) {
        console.log(`La tabla ${table} está vacía. Saltando...`);
        continue;
      }
      
      const columns = Object.keys(rows[0]);
      
      // Limpiar la tabla de destino para evitar duplicados
      await pgClient.query(`TRUNCATE TABLE ${table} CASCADE`);
      
      for (const row of rows) {
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const vals = columns.map(col => row[col]);
        const insertSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        await pgClient.query(insertSql, vals);
      }
      
      console.log(`✓ Tabla ${table} migrada con éxito (${rows.length} registros).`);
    }

    // 3. Ajustar secuencias de ID de PostgreSQL
    console.log('Ajustando secuencias de claves primarias seriales...');
    const serialTables = ['usuarios', 'clientes', 'trabajadores', 'registro_hh', 'gastos_diarios', 'facturacion', 'gastos_generales', 'archivos_ot'];
    for (const t of serialTables) {
      await pgClient.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE(MAX(id), 1)) FROM ${t}`);
    }

    console.log('¡Migración completada con éxito!');
  } catch (error) {
    console.error('Error durante la migración:', error);
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

runMigration();
