import pkg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { createRequire } from 'module';

const { Pool } = pkg;
const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'trimec.db');

// Detectar si estamos usando PostgreSQL (Supabase) o si estamos en Vercel
const isPostgres = !!process.env.DATABASE_URL || !!process.env.VERCEL;

let dbSqlite = null;
let pgPool = null;

if (isPostgres) {
  console.log('Conectado a la base de datos cloud PostgreSQL (Supabase).');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL || '',
    ssl: { rejectUnauthorized: false }
  });
} else {
  console.log('Conectado a la base de datos SQLite local.');
  if (process.env.VERCEL) {
    throw new Error('SQLite no está soportado en el entorno Vercel Serverless.');
  }
  const libName = 'sqlite3';
  const sqlite3 = require(libName);
  dbSqlite = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error al abrir la base de datos SQLite:', err.message);
    }
  });
}

// Convertir placeholders ? de SQLite a $1, $2 de Postgres
function convertPlaceholders(sql) {
  if (!isPostgres) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

// Traducir DDL para compatibilidad Postgres
function translateDdl(sql) {
  if (!isPostgres) return sql;
  return sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/AUTOINCREMENT/gi, '')
    .replace(/REAL/gi, 'DOUBLE PRECISION')
    .replace(/TEXT/gi, 'VARCHAR(255)')
    .replace(/detalle VARCHAR\(255\) NOT NULL/gi, 'detalle TEXT NOT NULL') // Textareas largos
    .replace(/actividad VARCHAR\(255\)/gi, 'actividad TEXT');
}

// Helpers asíncronos unificados
export const query = (sql, params = []) => {
  if (isPostgres) {
    const finalSql = convertPlaceholders(sql);
    return pgPool.query(finalSql, params).then(res => res.rows);
  } else {
    return new Promise((resolve, reject) => {
      dbSqlite.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

export const get = (sql, params = []) => {
  if (isPostgres) {
    const finalSql = convertPlaceholders(sql);
    return pgPool.query(finalSql, params).then(res => res.rows[0]);
  } else {
    return new Promise((resolve, reject) => {
      dbSqlite.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

export const run = (sql, params = []) => {
  if (isPostgres) {
    let finalSql = convertPlaceholders(sql);
    // Postgres requiere RETURNING para emular lastID de inserción
    if (finalSql.trim().toUpperCase().startsWith('INSERT')) {
      if (!finalSql.toUpperCase().includes('RETURNING')) {
        finalSql += ' RETURNING id';
      }
    }
    return pgPool.query(finalSql, params).then(res => {
      const firstRow = res.rows[0];
      return { 
        id: firstRow ? firstRow.id : null,
        changes: res.rowCount 
      };
    });
  } else {
    return new Promise((resolve, reject) => {
      dbSqlite.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
};

// Inicialización de la base de datos
export const initDb = async () => {
  if (isPostgres) {
    console.log('Inicializando funciones de compatibilidad SQLite para PostgreSQL...');
    
    // Crear la función strftime en Postgres para soportar las consultas originales del backend
    await pgPool.query(`
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

    await pgPool.query(`
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
    
    await pgPool.query(`
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
  }

  // Migraciones automáticas sólo en SQLite (en Supabase la BD se inicia de cero o vía script)
  if (!isPostgres) {
    let rebuild = false;
    try {
      const cols = await query("PRAGMA table_info(clientes)");
      if (cols && cols.length > 0) {
        const hasCol = cols.some(c => c.name === 'prefijo');
        if (!hasCol) {
          rebuild = true;
        }
      }
    } catch (e) {}

    if (rebuild) {
      console.log('Migración: Reconstruyendo tablas locales...');
      await run('DROP TABLE IF EXISTS registro_hh');
      await run('DROP TABLE IF EXISTS gastos_diarios');
      await run('DROP TABLE IF EXISTS facturacion');
      await run('DROP TABLE IF EXISTS ordenes_trabajo');
      await run('DROP TABLE IF EXISTS clientes');
      await run('DROP TABLE IF EXISTS trabajadores');
      await run('DROP TABLE IF EXISTS usuarios');
    }

    try {
      const otCols = await query("PRAGMA table_info(ordenes_trabajo)");
      if (otCols && otCols.length > 0) {
        const hasHh = otCols.some(c => c.name === 'hh_presupuestadas');
        if (!hasHh) {
          await run("ALTER TABLE ordenes_trabajo ADD COLUMN hh_presupuestadas REAL DEFAULT 0.0");
        }
      }
    } catch (e) {}

    try {
      const wCols = await query("PRAGMA table_info(trabajadores)");
      if (wCols && wCols.length > 0) {
        const hasExpected = wCols.some(c => c.name === 'horas_mensuales_esperadas');
        if (!hasExpected) {
          await run("ALTER TABLE trabajadores ADD COLUMN horas_mensuales_esperadas REAL DEFAULT 180.0");
        }
      }
    } catch (e) {}
  }

  // DDLs unificados (se traducen en caliente para Postgres)
  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('admin', 'supervisor', 'contador'))
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      rut TEXT NOT NULL UNIQUE,
      razon_social TEXT NOT NULL,
      prefijo TEXT NOT NULL UNIQUE,
      contacto_nombre TEXT,
      contacto_email TEXT,
      contacto_telefono TEXT
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS trabajadores (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL,
      sueldo_base REAL,
      valor_hh_normal REAL NOT NULL,
      valor_hh_extra REAL NOT NULL,
      horas_mensuales_esperadas REAL DEFAULT 180.0
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS ordenes_trabajo (
      id TEXT PRIMARY KEY,
      cliente_id INTEGER NOT NULL,
      usuario_id INTEGER,
      detalle TEXT NOT NULL,
      estado TEXT NOT NULL CHECK(estado IN ('SP', 'Presupuestada', 'Aprobada', 'En Proceso', 'Terminada', 'Liquidada', 'Facturada')),
      es_emergencia INTEGER NOT NULL DEFAULT 0 CHECK(es_emergencia IN (0, 1)),
      recargo_emergencia REAL NOT NULL DEFAULT 0.0,
      fecha_solicitud TEXT,
      fecha_aprobacion TEXT,
      fecha_entrega TEXT,
      monto_neto_presupuesto REAL DEFAULT 0.0,
      hh_presupuestadas REAL DEFAULT 0.0
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS registro_hh (
      id SERIAL PRIMARY KEY,
      ot_id TEXT NOT NULL,
      trabajador_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      horas_normales REAL NOT NULL DEFAULT 0.0,
      horas_extra REAL NOT NULL DEFAULT 0.0,
      ubicacion TEXT NOT NULL CHECK(ubicacion IN ('Taller', 'Terreno')),
      actividad TEXT
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS gastos_diarios (
      id SERIAL PRIMARY KEY,
      ot_id TEXT NOT NULL,
      fecha TEXT NOT NULL,
      clasificacion TEXT NOT NULL CHECK(clasificacion IN ('INSUMOS', 'Almuerzo', 'Plotteo', 'Peaje', 'Combustible', 'Otros')),
      detalle TEXT NOT NULL,
      cantidad REAL NOT NULL DEFAULT 1.0,
      valor_neto REAL NOT NULL DEFAULT 0.0,
      valor_iva REAL NOT NULL DEFAULT 0.0,
      valor_total REAL NOT NULL DEFAULT 0.0
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS facturacion (
      id SERIAL PRIMARY KEY,
      ot_id TEXT NOT NULL UNIQUE,
      nro_oc TEXT,
      fecha_oc TEXT,
      nro_hes TEXT,
      nro_factura TEXT,
      fecha_factura TEXT,
      estado_pago TEXT NOT NULL DEFAULT 'Pendiente' CHECK(estado_pago IN ('Pendiente', 'Pagado', 'Anulado'))
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS gastos_generales (
      id SERIAL PRIMARY KEY,
      fecha TEXT NOT NULL,
      familia TEXT NOT NULL,
      detalle TEXT NOT NULL,
      valor_total REAL NOT NULL DEFAULT 0.0
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS archivos_ot (
      id SERIAL PRIMARY KEY,
      ot_id TEXT NOT NULL,
      nombre_original TEXT NOT NULL,
      nombre_guardado TEXT NOT NULL,
      tipo TEXT NOT NULL,
      fecha_subida TEXT NOT NULL
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS inventario (
      sku TEXT PRIMARY KEY,
      descripcion TEXT NOT NULL,
      proveedor TEXT,
      fecha_ultimo_pedido TEXT,
      stock REAL DEFAULT 0.0,
      ubicacion TEXT,
      valor_unitario REAL DEFAULT 0.0
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS inventario_movimientos (
      id SERIAL PRIMARY KEY,
      tipo TEXT NOT NULL CHECK(tipo IN ('ENTRADA', 'SALIDA')),
      fecha TEXT NOT NULL,
      sku TEXT NOT NULL,
      cantidad REAL NOT NULL,
      valor_unitario REAL DEFAULT 0.0,
      factura_num TEXT,
      proveedor_o_cliente TEXT,
      ot_id TEXT
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS activos (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      tipo TEXT,
      ubicacion TEXT,
      proveedor TEXT,
      valor_compra REAL DEFAULT 0.0,
      garantia_vencimiento TEXT,
      condicion TEXT,
      cantidad INTEGER DEFAULT 1,
      modelo TEXT,
      observaciones TEXT,
      asignado_a_trabajador_id INTEGER,
      asignado_a_ot_id TEXT
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS cotizaciones (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER NOT NULL,
      detalle TEXT NOT NULL,
      monto_neto_presupuesto REAL DEFAULT 0.0,
      utilidad_porcentaje REAL DEFAULT 25.0,
      hh_estimadas TEXT,
      materiales_estimados TEXT,
      terceros_estimados REAL DEFAULT 0.0,
      fecha_creacion TEXT,
      estado TEXT DEFAULT 'CREADA',
      ot_creada_id TEXT
    )
  `));

  await run(translateDdl(`
    CREATE TABLE IF NOT EXISTS informes_tecnicos (
      id SERIAL PRIMARY KEY,
      ot_id TEXT NOT NULL UNIQUE,
      antes_condicion TEXT,
      despues_tareas TEXT,
      recomendaciones TEXT,
      fotos_antes TEXT,
      fotos_despues TEXT
    )
  `));

  // Sembrar usuarios iniciales
  const userCount = await get(`SELECT COUNT(*) as count FROM usuarios`);
  if (parseInt(userCount.count, 10) === 0) {
    console.log('Sembrando usuarios iniciales...');
    const hashedPwd = await bcrypt.hash('trimec123', 10);
    await run(`
      INSERT INTO usuarios (nombre, email, password_hash, rol) 
      VALUES 
      ('Angelo Muñoz V.', 'angelo@trimec.cl', ?, 'admin'),
      ('Supervisor Operaciones', 'supervisor@trimec.cl', ?, 'supervisor'),
      ('Contador Finanzas', 'contador@trimec.cl', ?, 'contador')
    `, [hashedPwd, hashedPwd, hashedPwd]);
  }

  // Sembrar trabajadores
  const workersCount = await get(`SELECT COUNT(*) as count FROM trabajadores`);
  if (parseInt(workersCount.count, 10) === 0) {
    console.log('Sembrando trabajadores iniciales...');
    const initialWorkers = [
      { nombre: 'Alvaro', rol: 'Supervisor', sueldo_base: 700000, valor_hh_normal: 9759, valor_hh_extra: 14638 },
      { nombre: 'Christian', rol: 'Mecánico M1', sueldo_base: 700000, valor_hh_normal: 4167, valor_hh_extra: 6250 },
      { nombre: 'Geremy', rol: 'Ayudante Carpintero', sueldo_base: 553553, valor_hh_normal: 3298, valor_hh_extra: 4946 },
      { nombre: 'Helton', rol: 'Soldador MIG', sueldo_base: 553553, valor_hh_normal: 5781, valor_hh_extra: 8671 },
      { nombre: 'Juan', rol: 'Soldador MIG', sueldo_base: 553553, valor_hh_normal: 5889, valor_hh_extra: 8833 },
      { nombre: 'Manuel', rol: 'Soldador TIG', sueldo_base: 700000, valor_hh_normal: 4321, valor_hh_extra: 6481 },
      { nombre: 'Marcos', rol: 'Ayudante Mecánico', sueldo_base: 700000, valor_hh_normal: 4167, valor_hh_extra: 6250 },
      { nombre: 'Paredes', rol: 'Supervisor 2°', sueldo_base: 700000, valor_hh_normal: 3333, valor_hh_extra: 5000 },
      { nombre: 'Soldador 1', rol: 'Soldador Arco', sueldo_base: 553553, valor_hh_normal: 4525, valor_hh_extra: 6788 }
    ];

    for (const w of initialWorkers) {
      await run(`
        INSERT INTO trabajadores (nombre, rol, sueldo_base, valor_hh_normal, valor_hh_extra)
        VALUES (?, ?, ?, ?, ?)
      `, [w.nombre, w.rol, w.sueldo_base, w.valor_hh_normal, w.valor_hh_extra]);
    }
  }

  // Sembrar clientes
  const clientCount = await get(`SELECT COUNT(*) as count FROM clientes`);
  if (parseInt(clientCount.count, 10) === 0) {
    console.log('Sembrando clientes iniciales...');
    const initialClients = [
      { rut: '76.123.456-7', razon_social: 'SERFOCOL S.A.', prefijo: 'SER', contacto_nombre: 'Fabián Alarcón', contacto_email: 'fabian@serfocol.cl', contacto_telefono: '+56911111111' },
      { rut: '77.987.654-3', razon_social: 'MOLINO HEREDIA S.A.', prefijo: 'MHE', contacto_nombre: 'Jonathan Hernández', contacto_email: 'jhernandez@heredia.cl', contacto_telefono: '+56922222222' },
      { rut: '76.543.210-K', razon_social: 'ARAUCO S.A.', prefijo: 'ARA', contacto_nombre: 'Vicente Chávez', contacto_email: 'vchavez@arauco.cl', contacto_telefono: '+56933333333' },
      { rut: '78.111.222-3', razon_social: 'MOLINO EL CARMEN', prefijo: 'MEC', contacto_nombre: 'J. Hernández', contacto_email: 'jhernandez@elcarmen.cl', contacto_telefono: '+56944444444' },
      { rut: '79.333.444-5', razon_social: 'PROMASA', prefijo: 'PRO', contacto_nombre: 'Guillermo Oñate', contacto_email: 'gonate@promasa.cl', contacto_telefono: '+56955555555' }
    ];
    for (const c of initialClients) {
      await run(`
        INSERT INTO clientes (rut, razon_social, prefijo, contacto_nombre, contacto_email, contacto_telefono)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [c.rut, c.razon_social, c.prefijo, c.contacto_nombre, c.contacto_email, c.contacto_telefono]);
    }
  }
};

const db = isPostgres ? pgPool : dbSqlite;
export default db;
