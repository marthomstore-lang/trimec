import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { get, run, query, initDb } from './db.js';
import { generateBudgetPDF } from './pdfGenerator.js';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar cliente Supabase si las credenciales están disponibles
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'trimec_secret_key_12345';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Permitir payloads JSON más grandes para base64
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Asegurar existencia de carpeta uploads (sólo en desarrollo/local)
if (process.env.NODE_ENV !== 'production') {
  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}


// Initialize Database
initDb()
  .then(() => console.log('Tablas inicializadas y datos sembrados correctamente.'))
  .catch((err) => console.error('Error al inicializar la base de datos:', err));

// Middleware de Autenticación
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Token no provisto' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido o expirado' });
  }
};

// Middleware para validar roles
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'Acceso no autorizado para este rol' });
    }
    next();
  };
};

// --- AUTH ROUTE ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await get('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ message: 'Usuario no encontrado' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign({ id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { nombre: user.nombre, email: user.email, rol: user.rol } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});


app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV,
    isPostgres: !!process.env.DATABASE_URL,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_KEY
  });
});

// --- CLIENTS ROUTES ---
app.get('/api/clientes', authenticate, async (req, res) => {
  try {
    const clients = await query('SELECT * FROM clientes ORDER BY razon_social ASC');
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clientes', authenticate, checkRole(['admin']), async (req, res) => {
  const { rut, razon_social, prefijo, contacto_nombre, contacto_email, contacto_telefono } = req.body;
  try {
    const result = await run(
      'INSERT INTO clientes (rut, razon_social, prefijo, contacto_nombre, contacto_email, contacto_telefono) VALUES (?, ?, ?, ?, ?, ?)',
      [rut, razon_social, prefijo ? prefijo.toUpperCase() : '', contacto_nombre, contacto_email, contacto_telefono]
    );
    res.status(201).json({ id: result.id, message: 'Cliente creado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clientes/:id', authenticate, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { rut, razon_social, prefijo, contacto_nombre, contacto_email, contacto_telefono } = req.body;
  try {
    await run(
      'UPDATE clientes SET rut = ?, razon_social = ?, prefijo = ?, contacto_nombre = ?, contacto_email = ?, contacto_telefono = ? WHERE id = ?',
      [rut, razon_social, prefijo ? prefijo.toUpperCase() : '', contacto_nombre, contacto_email, contacto_telefono, id]
    );
    res.json({ message: 'Cliente actualizado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- USUARIOS CRUD ENDPOINTS ---

// Obtener todos los usuarios (solo administradores)
app.get('/api/usuarios', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const users = await query('SELECT id, nombre, email, rol FROM usuarios ORDER BY nombre ASC');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear un nuevo usuario (solo administradores)
app.post('/api/usuarios', authenticate, checkRole(['admin']), async (req, res) => {
  const { nombre, email, password, rol } = req.body;
  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }
  try {
    const existingUser = await get('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ message: 'El correo ya está registrado por otro usuario' });
    }
    const hashedPwd = await bcrypt.hash(password, 10);
    const result = await run(`
      INSERT INTO usuarios (nombre, email, password_hash, rol) 
      VALUES (?, ?, ?, ?)
    `, [nombre, email, hashedPwd, rol]);
    res.status(201).json({ id: result.id, nombre, email, rol });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Modificar un usuario existente (solo administradores)
app.put('/api/usuarios/:id', authenticate, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { nombre, email, password, rol } = req.body;
  if (!nombre || !email || !rol) {
    return res.status(400).json({ message: 'Nombre, email y rol son obligatorios' });
  }
  try {
    const existingUser = await get('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, id]);
    if (existingUser) {
      return res.status(400).json({ message: 'El correo ya está registrado por otro usuario' });
    }
    if (password && password.trim() !== '') {
      const hashedPwd = await bcrypt.hash(password, 10);
      await run(`
        UPDATE usuarios 
        SET nombre = ?, email = ?, password_hash = ?, rol = ? 
        WHERE id = ?
      `, [nombre, email, hashedPwd, rol, id]);
    } else {
      await run(`
        UPDATE usuarios 
        SET nombre = ?, email = ?, rol = ? 
        WHERE id = ?
      `, [nombre, email, rol, id]);
    }
    res.json({ id: parseInt(id), nombre, email, rol });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un usuario (solo administradores)
app.delete('/api/usuarios/:id', authenticate, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  if (req.user.id === parseInt(id)) {
    return res.status(400).json({ message: 'No puedes eliminar tu propio usuario' });
  }
  try {
    await run('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- TRABAJADORES ROUTES ---
app.get('/api/trabajadores', authenticate, async (req, res) => {
  try {
    const workers = await query('SELECT * FROM trabajadores ORDER BY nombre ASC');
    res.json(workers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/trabajadores', authenticate, checkRole(['admin']), async (req, res) => {
  const { nombre, rol, sueldo_base, valor_hh_normal, valor_hh_extra, horas_mensuales_esperadas } = req.body;
  try {
    const result = await run(
      'INSERT INTO trabajadores (nombre, rol, sueldo_base, valor_hh_normal, valor_hh_extra, horas_mensuales_esperadas) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, rol, sueldo_base || 0.0, valor_hh_normal, valor_hh_extra, horas_mensuales_esperadas || 180.0]
    );
    res.status(201).json({ id: result.id, message: 'Trabajador creado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/trabajadores/:id', authenticate, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { nombre, rol, sueldo_base, valor_hh_normal, valor_hh_extra, horas_mensuales_esperadas } = req.body;
  try {
    await run(
      'UPDATE trabajadores SET nombre = ?, rol = ?, sueldo_base = ?, valor_hh_normal = ?, valor_hh_extra = ?, horas_mensuales_esperadas = ? WHERE id = ?',
      [nombre, rol, sueldo_base || 0.0, valor_hh_normal, valor_hh_extra, horas_mensuales_esperadas || 180.0, id]
    );
    res.json({ message: 'Trabajador actualizado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/trabajadores/:id', authenticate, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    await run('DELETE FROM trabajadores WHERE id = ?', [id]);
    res.json({ message: 'Trabajador eliminado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- OTS ROUTES ---
app.get('/api/ots/siguiente-numero', authenticate, async (req, res) => {
  try {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = String(today.getFullYear()).slice(-2);
    const datePrefix = `${dd}${mm}${yy}`; // Formato DDMMYY

    const ots = await query(`SELECT id FROM ordenes_trabajo WHERE id LIKE '%${datePrefix}.%'`);
    
    let maxSeq = 0;
    if (ots && ots.length > 0) {
      for (const ot of ots) {
        const parts = ot.id.toString().split('-');
        const suffix = parts[parts.length - 1]; // e.g. "260701.1"
        const subparts = suffix.split('.');
        if (subparts.length === 2 && subparts[0] === datePrefix) {
          const seqVal = parseInt(subparts[1], 10);
          if (!isNaN(seqVal) && seqVal > maxSeq) {
            maxSeq = seqVal;
          }
        }
      }
    }
    
    const nextSeq = maxSeq + 1;
    const finalNumber = `${datePrefix}.${nextSeq}`; 
    
    res.json({ siguiente_numero: finalNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener lista de OTs con sus costos agregados y márgenes
app.get('/api/ots', authenticate, async (req, res) => {
  try {
    // Si es Supervisor, solo ve OTs operativas y activas (no cerradas o liquidadas si así se configura, pero puede ver todas)
    // Mostramos todas pero agregadas con cálculo de margen
    const ots = await query(`
      SELECT o.*, c.razon_social as cliente_nombre 
      FROM ordenes_trabajo o 
      JOIN clientes c ON o.cliente_id = c.id
      ORDER BY o.id DESC
    `);

    // Calcular costos y márgenes para cada OT
    const calculatedOts = await Promise.all(
      ots.map(async (ot) => {
        // Costo HH
        const hhCost = await get(`
          SELECT SUM((r.horas_normales * t.valor_hh_normal) + (r.horas_extra * t.valor_hh_extra)) as total 
          FROM registro_hh r 
          JOIN trabajadores t ON r.trabajador_id = t.id 
          WHERE r.ot_id = ?
        `, [ot.id]);

        // Costo Gastos Diarios
        const expenseCost = await get(`
          SELECT SUM(valor_neto) as total 
          FROM gastos_diarios 
          WHERE ot_id = ?
        `, [ot.id]);

        const totalHh = hhCost.total || 0;
        const totalExpense = expenseCost.total || 0;
        const totalCost = totalHh + totalExpense;

        const netIncome = ot.monto_neto_presupuesto || 0;
        const profit = netIncome - totalCost;
        const marginPct = netIncome > 0 ? (profit / netIncome) * 100 : 0;

        // Facturación Info
        const fact = await get('SELECT * FROM facturacion WHERE ot_id = ?', [ot.id]);

        return {
          ...ot,
          costo_hh: totalHh,
          costo_gastos: totalExpense,
          costo_total: totalCost,
          margen_monto: profit,
          margen_porcentaje: marginPct,
          facturacion: fact || null
        };
      })
    );

    res.json(calculatedOts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ots/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const ot = await get(`
      SELECT o.*, c.razon_social as cliente_nombre, c.rut as cliente_rut, c.contacto_nombre, c.contacto_email, c.contacto_telefono 
      FROM ordenes_trabajo o 
      JOIN clientes c ON o.cliente_id = c.id
      WHERE o.id = ?
    `, [id]);

    if (!ot) {
      return res.status(404).json({ message: 'OT no encontrada' });
    }

    const hhCost = await get(`
      SELECT SUM((r.horas_normales * t.valor_hh_normal) + (r.horas_extra * t.valor_hh_extra)) as total 
      FROM registro_hh r 
      JOIN trabajadores t ON r.trabajador_id = t.id 
      WHERE r.ot_id = ?
    `, [id]);

    const expenseCost = await get(`
      SELECT SUM(valor_neto) as total 
      FROM gastos_diarios 
      WHERE ot_id = ?
    `, [id]);

    const totalHh = hhCost.total || 0;
    const totalExpense = expenseCost.total || 0;
    const totalCost = totalHh + totalExpense;

    const netIncome = ot.monto_neto_presupuesto || 0;
    const profit = netIncome - totalCost;
    const marginPct = netIncome > 0 ? (profit / netIncome) * 100 : 0;

    // Facturación Info
    const fact = await get('SELECT * FROM facturacion WHERE ot_id = ?', [id]);

    res.json({
      ...ot,
      costo_hh: totalHh,
      costo_gastos: totalExpense,
      costo_total: totalCost,
      margen_monto: profit,
      margen_porcentaje: marginPct,
      facturacion: fact || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ots', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { id, cliente_id, detalle, estado, es_emergencia, recargo_emergencia, fecha_solicitud, fecha_aprobacion, fecha_entrega, monto_neto_presupuesto, hh_presupuestadas, fecha_proyectada_presupuesto } = req.body;
  try {
    await run(
      `INSERT INTO ordenes_trabajo 
      (id, cliente_id, usuario_id, detalle, estado, es_emergencia, recargo_emergencia, fecha_solicitud, fecha_aprobacion, fecha_entrega, monto_neto_presupuesto, hh_presupuestadas, fecha_proyectada_presupuesto) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cliente_id, req.user.id, detalle, estado || 'SP', es_emergencia ? 1 : 0, recargo_emergencia || 0.0, fecha_solicitud, fecha_aprobacion, fecha_entrega, monto_neto_presupuesto || 0.0, hh_presupuestadas || 0.0, fecha_proyectada_presupuesto]
    );

    // Crear registro vacío de facturación
    await run('INSERT OR IGNORE INTO facturacion (ot_id) VALUES (?)', [id]);

    res.status(201).json({ id, message: 'OT creada con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/ots/:id', authenticate, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { cliente_id, detalle, estado, es_emergencia, recargo_emergencia, fecha_solicitud, fecha_aprobacion, fecha_entrega, monto_neto_presupuesto, hh_presupuestadas, fecha_proyectada_presupuesto } = req.body;
  
  try {
    await run(
      `UPDATE ordenes_trabajo 
       SET cliente_id = ?, detalle = ?, estado = ?, es_emergencia = ?, recargo_emergencia = ?, fecha_solicitud = ?, fecha_aprobacion = ?, fecha_entrega = ?, monto_neto_presupuesto = ?, hh_presupuestadas = ?, fecha_proyectada_presupuesto = ?
       WHERE id = ?`,
      [cliente_id, detalle, estado, es_emergencia ? 1 : 0, recargo_emergencia, fecha_solicitud, fecha_aprobacion, fecha_entrega, monto_neto_presupuesto, hh_presupuestadas, fecha_proyectada_presupuesto, id]
    );
    res.json({ message: 'OT actualizada con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- REGISTRO HH (BITACORA HH) ---
app.get('/api/hh', authenticate, async (req, res) => {
  try {
    const hhRecords = await query(`
      SELECT r.*, o.detalle as ot_detalle, t.nombre as trabajador_nombre, t.rol as trabajador_rol
      FROM registro_hh r
      JOIN ordenes_trabajo o ON r.ot_id = o.id
      JOIN trabajadores t ON r.trabajador_id = t.id
      ORDER BY r.fecha DESC, r.id DESC
    `);
    res.json(hhRecords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hh/ot/:ot_id', authenticate, async (req, res) => {
  const { ot_id } = req.params;
  try {
    const hhRecords = await query(`
      SELECT r.*, t.nombre as trabajador_nombre, t.rol as trabajador_rol,
             ((r.horas_normales * t.valor_hh_normal) + (r.horas_extra * t.valor_hh_extra)) as costo_calculado
      FROM registro_hh r
      JOIN trabajadores t ON r.trabajador_id = t.id
      WHERE r.ot_id = ?
      ORDER BY r.fecha DESC
    `, [ot_id]);
    res.json(hhRecords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hh', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { ot_id, trabajador_id, fecha, horas_normales, horas_extra, ubicacion, actividad } = req.body;
  try {
    const result = await run(
      'INSERT INTO registro_hh (ot_id, trabajador_id, fecha, horas_normales, horas_extra, ubicacion, actividad) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [ot_id, trabajador_id, fecha, horas_normales || 0.0, horas_extra || 0.0, ubicacion || 'Taller', actividad]
    );
    res.status(201).json({ id: result.id, message: 'Registro de horas creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/hh/:id', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { id } = req.params;
  try {
    await run('DELETE FROM registro_hh WHERE id = ?', [id]);
    res.json({ message: 'Registro de horas eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- GASTOS DIARIOS ROUTES ---
app.get('/api/gastos', authenticate, async (req, res) => {
  try {
    const expenses = await query(`
      SELECT g.*, o.detalle as ot_detalle 
      FROM gastos_diarios g
      JOIN ordenes_trabajo o ON g.ot_id = o.id
      ORDER BY g.fecha DESC
    `);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/gastos/ot/:ot_id', authenticate, async (req, res) => {
  const { ot_id } = req.params;
  try {
    const expenses = await query('SELECT * FROM gastos_diarios WHERE ot_id = ? ORDER BY fecha DESC', [ot_id]);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gastos', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { ot_id, fecha, clasificacion, detalle, cantidad, valor_neto, valor_iva, valor_total } = req.body;
  try {
    const result = await run(
      'INSERT INTO gastos_diarios (ot_id, fecha, clasificacion, detalle, cantidad, valor_neto, valor_iva, valor_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [ot_id, fecha, clasificacion, detalle, cantidad || 1.0, valor_neto || 0.0, valor_iva || 0.0, valor_total || 0.0]
    );
    res.status(201).json({ id: result.id, message: 'Gasto registrado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/gastos/:id', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { id } = req.params;
  try {
    await run('DELETE FROM gastos_diarios WHERE id = ?', [id]);
    res.json({ message: 'Gasto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- FACTURACIÓN ROUTES ---
app.get('/api/facturacion', authenticate, checkRole(['admin', 'contador']), async (req, res) => {
  try {
    const factRecords = await query(`
      SELECT f.*, o.detalle as ot_detalle, o.monto_neto_presupuesto, c.razon_social as cliente_nombre 
      FROM facturacion f
      JOIN ordenes_trabajo o ON f.ot_id = o.id
      JOIN clientes c ON o.cliente_id = c.id
      ORDER BY f.id DESC
    `);
    res.json(factRecords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/facturacion/:ot_id', authenticate, checkRole(['admin', 'contador']), async (req, res) => {
  const { ot_id } = req.params;
  const { nro_oc, fecha_oc, nro_hes, nro_factura, fecha_factura, estado_pago } = req.body;
  try {
    await run(
      `UPDATE facturacion 
       SET nro_oc = ?, fecha_oc = ?, nro_hes = ?, nro_factura = ?, fecha_factura = ?, estado_pago = ? 
       WHERE ot_id = ?`,
      [nro_oc, fecha_oc, nro_hes, nro_factura, fecha_factura, estado_pago || 'Pendiente', ot_id]
    );
    res.json({ message: 'Datos de facturación actualizados' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- GASTOS GENERALES / FINANZAS EMPRESA ---
app.get('/api/finanzas/gastos-generales', authenticate, checkRole(['admin', 'contador']), async (req, res) => {
  try {
    const gg = await query('SELECT * FROM gastos_generales ORDER BY fecha DESC');
    res.json(gg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/finanzas/gastos-generales', authenticate, checkRole(['admin', 'contador']), async (req, res) => {
  const { fecha, familia, detalle, valor_total } = req.body;
  try {
    const result = await run(
      'INSERT INTO gastos_generales (fecha, familia, detalle, valor_total) VALUES (?, ?, ?, ?)',
      [fecha, familia, detalle, valor_total || 0.0]
    );
    res.status(201).json({ id: result.id, message: 'Gasto general registrado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/finanzas/gastos-generales/:id', authenticate, checkRole(['admin', 'contador']), async (req, res) => {
  const { id } = req.params;
  try {
    await run('DELETE FROM gastos_generales WHERE id = ?', [id]);
    res.json({ message: 'Gasto general eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reporte de Flujo de Caja Mensual
app.get('/api/finanzas/flujo-caja', authenticate, checkRole(['admin', 'contador']), async (req, res) => {
  try {
    // 1. Ingresos por OTs Facturadas (Facturaciones donde el estado no sea Anulado)
    const ingresos = await query(`
      SELECT STRFTIME('%Y-%m', o.fecha_solicitud) as mes, SUM(o.monto_neto_presupuesto) as total_ingreso
      FROM ordenes_trabajo o
      JOIN facturacion f ON f.ot_id = o.id
      WHERE f.nro_factura IS NOT NULL AND f.nro_factura != '' AND f.estado_pago != 'Anulado'
      GROUP BY mes
    `);

    // 2. Egresos Fijos de Gastos Generales
    const egresosFijos = await query(`
      SELECT STRFTIME('%Y-%m', fecha) as mes, SUM(valor_total) as total_egreso_fijo
      FROM gastos_generales
      GROUP BY mes
    `);

    // 3. Egresos Variables de OTs (Materiales y Comidas de OTs activas)
    const egresosOTs = await query(`
      SELECT STRFTIME('%Y-%m', fecha) as mes, SUM(valor_neto) as total_egreso_ot
      FROM gastos_diarios
      GROUP BY mes
    `);

    // Combinar en estructura organizada por mes
    const flujoMensual = {};

    ingresos.forEach(item => {
      if (item.mes) {
        flujoMensual[item.mes] = { mes: item.mes, ingresos: item.total_ingreso || 0, egresos: 0 };
      }
    });

    egresosFijos.forEach(item => {
      if (item.mes) {
        if (!flujoMensual[item.mes]) flujoMensual[item.mes] = { mes: item.mes, ingresos: 0, egresos: 0 };
        flujoMensual[item.mes].egresos += item.total_egreso_fijo || 0;
      }
    });

    egresosOTs.forEach(item => {
      if (item.mes) {
        if (!flujoMensual[item.mes]) flujoMensual[item.mes] = { mes: item.mes, ingresos: 0, egresos: 0 };
        flujoMensual[item.mes].egresos += item.total_egreso_ot || 0;
      }
    });

    const report = Object.values(flujoMensual).sort((a, b) => a.mes.localeCompare(b.mes));
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reporte de Rendimiento y Eficiencia Mensual de Personal
app.get('/api/finanzas/rendimiento-personal', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().substring(0, 7); // ej: "2026-07"
    const workers = await query('SELECT * FROM trabajadores ORDER BY nombre ASC');
    
    const performance = await Promise.all(
      workers.map(async (w) => {
        // Horas totales del mes
        const hoursSummary = await get(`
          SELECT SUM(horas_normales + horas_extra) as total_horas 
          FROM registro_hh 
          WHERE trabajador_id = ? AND STRFTIME('%Y-%m', fecha) = ?
        `, [w.id, currentMonth]);
        
        // Desglose de horas por OT
        const breakdown = await query(`
          SELECT r.ot_id, o.detalle as ot_detalle, SUM(r.horas_normales + r.horas_extra) as horas_ot
          FROM registro_hh r
          JOIN ordenes_trabajo o ON r.ot_id = o.id
          WHERE r.trabajador_id = ? AND STRFTIME('%Y-%m', r.fecha) = ?
          GROUP BY r.ot_id, o.detalle
        `, [w.id, currentMonth]);

        return {
          id: w.id,
          nombre: w.nombre,
          rol: w.rol,
          horas_mensuales_esperadas: w.horas_mensuales_esperadas || 180.0,
          horas_reales: hoursSummary.total_horas || 0,
          desglose: breakdown || []
        };
      })
    );
    
    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- PDF GENERATOR ENDPOINT ---
app.get('/api/ots/:id/pdf', async (req, res) => {
  const { id } = req.params;
  try {
    const ot = await get(`
      SELECT o.*, c.razon_social, c.rut, c.contacto_nombre, c.contacto_email, c.contacto_telefono 
      FROM ordenes_trabajo o 
      JOIN clientes c ON o.cliente_id = c.id
      WHERE o.id = ?
    `, [id]);

    if (!ot) {
      return res.status(404).send('Orden de Trabajo no encontrada');
    }

    const client = {
      razon_social: ot.razon_social,
      rut: ot.rut,
      contacto_nombre: ot.contacto_nombre,
      contacto_email: ot.contacto_email,
      contacto_telefono: ot.contacto_telefono
    };

    // Obtener los ítems específicos de cotización/gasto si los hay, sino pasamos vacíos
    const items = await query('SELECT detalle, cantidad, valor_neto as valor_total FROM gastos_diarios WHERE ot_id = ? AND clasificacion != \'Almuerzo\'', [id]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=presupuesto-ot-${id}.pdf`);

    generateBudgetPDF(ot, client, items, res);
  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).send('Error interno al generar el PDF del presupuesto.');
  }
});

// --- OT FILES / ATTACHMENTS ROUTES ---
app.post('/api/ots/:otId/archivos', authenticate, async (req, res) => {
  const { otId } = req.params;
  const { filename, filetype, base64Data } = req.body;
  
  if (!filename || !base64Data) {
    return res.status(400).json({ error: 'Faltan datos del archivo' });
  }
  
  try {
    const base64Clean = base64Data.split(';base64,').pop();
    const buffer = Buffer.from(base64Clean, 'base64');
    
    const ext = path.extname(filename);
    const cleanName = path.basename(filename, ext).replace(/[^a-zA-Z0-9]/g, '_');
    const filenameUnique = `${otId}_${Date.now()}_${cleanName}${ext}`;
    
    let storedIdentifier = filenameUnique;
    
    if (supabase) {
      // Subir a Supabase Storage Bucket
      const { data, error } = await supabase.storage
        .from('trimec-archivos')
        .upload(filenameUnique, buffer, {
          contentType: filetype,
          duplex: 'half'
        });
      if (error) {
        throw error;
      }
      
      const { data: urlData } = supabase.storage
        .from('trimec-archivos')
        .getPublicUrl(filenameUnique);
        
      storedIdentifier = urlData.publicUrl;
    } else {
      const filePath = path.join(__dirname, 'uploads', filenameUnique);
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }
      fs.writeFileSync(filePath, buffer);
    }
    
    const now = new Date().toISOString().split('T')[0];
    await run(
      'INSERT INTO archivos_ot (ot_id, nombre_original, nombre_guardado, tipo, fecha_subida) VALUES (?, ?, ?, ?, ?)',
      [otId, filename, storedIdentifier, filetype, now]
    );
    
    res.status(201).json({ message: 'Archivo subido con éxito', filenameUnique });
  } catch (error) {
    console.error('Error al subir archivo:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ots/:otId/archivos', authenticate, async (req, res) => {
  const { otId } = req.params;
  try {
    const files = await query(
      'SELECT * FROM archivos_ot WHERE ot_id = ? ORDER BY id DESC',
      [otId]
    );
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/archivos/:id', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { id } = req.params;
  try {
    const file = await get('SELECT * FROM archivos_ot WHERE id = ?', [id]);
    if (!file) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    const isUrl = file.nombre_guardado.startsWith('http://') || file.nombre_guardado.startsWith('https://');
    
    if (isUrl && supabase) {
      const parts = file.nombre_guardado.split('/trimec-archivos/');
      const filenameUnique = parts[parts.length - 1];
      
      const { error } = await supabase.storage
        .from('trimec-archivos')
        .remove([filenameUnique]);
      if (error) {
        console.error('Error eliminando archivo de Supabase Storage:', error);
      }
    } else {
      const filePath = path.join(__dirname, 'uploads', file.nombre_guardado);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    await run('DELETE FROM archivos_ot WHERE id = ?', [id]);
    res.json({ message: 'Archivo eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =========================================================================
// MÓDULOS DE INVENTARIO, ACTIVOS, COTIZACIONES E INFORMES TÉCNICOS
// =========================================================================

// --- INVENTARIO ---
app.get('/api/inventario', authenticate, async (req, res) => {
  try {
    const items = await query('SELECT * FROM inventario ORDER BY sku ASC');
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inventario', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { sku, descripcion, proveedor, fecha_ultimo_pedido, stock, ubicacion, valor_unitario } = req.body;
  if (!sku || !descripcion) {
    return res.status(400).json({ message: 'SKU y descripción son obligatorios' });
  }
  try {
    const existing = await get('SELECT sku FROM inventario WHERE sku = ?', [sku]);
    if (existing) {
      await run(`
        UPDATE inventario 
        SET descripcion = ?, proveedor = ?, fecha_ultimo_pedido = ?, stock = ?, ubicacion = ?, valor_unitario = ?
        WHERE sku = ?
      `, [descripcion, proveedor, fecha_ultimo_pedido, parseFloat(stock) || 0.0, ubicacion, parseFloat(valor_unitario) || 0.0, sku]);
    } else {
      await run(`
        INSERT INTO inventario (sku, descripcion, proveedor, fecha_ultimo_pedido, stock, ubicacion, valor_unitario)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [sku, descripcion, proveedor, fecha_ultimo_pedido, parseFloat(stock) || 0.0, ubicacion, parseFloat(valor_unitario) || 0.0]);
    }
    res.json({ sku, descripcion, proveedor, fecha_ultimo_pedido, stock, ubicacion, valor_unitario });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventario/movimientos', authenticate, async (req, res) => {
  try {
    const movs = await query('SELECT * FROM inventario_movimientos ORDER BY id DESC');
    res.json(movs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inventario/movimiento', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { tipo, fecha, sku, cantidad, valor_unitario, factura_num, proveedor_o_cliente, ot_id } = req.body;
  if (!tipo || !fecha || !sku || !cantidad) {
    return res.status(400).json({ message: 'Tipo, fecha, SKU y cantidad son obligatorios' });
  }
  try {
    const item = await get('SELECT * FROM inventario WHERE sku = ?', [sku]);
    if (!item) {
      return res.status(404).json({ message: 'Insumo no encontrado en inventario' });
    }
    
    // Registrar el movimiento
    await run(`
      INSERT INTO inventario_movimientos (tipo, fecha, sku, cantidad, valor_unitario, factura_num, proveedor_o_cliente, ot_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [tipo, fecha, sku, parseFloat(cantidad), parseFloat(valor_unitario) || 0.0, factura_num, proveedor_o_cliente, ot_id]);

    // Recalcular stock del item
    let newStock = item.stock || 0.0;
    if (tipo === 'ENTRADA') {
      newStock += parseFloat(cantidad);
    } else if (tipo === 'SALIDA') {
      newStock -= parseFloat(cantidad);
    }
    
    await run(`
      UPDATE inventario 
      SET stock = ?, valor_unitario = ?, fecha_ultimo_pedido = ? 
      WHERE sku = ?
    `, [newStock, parseFloat(valor_unitario) || item.valor_unitario, fecha, sku]);

    // Si es salida asociada a una OT, agregar automáticamente a gastos_diarios
    if (tipo === 'SALIDA' && ot_id) {
      const net = (parseFloat(valor_unitario) || item.valor_unitario || 0.0) * parseFloat(cantidad);
      const iva = net * 0.19;
      const total = net + iva;
      await run(`
        INSERT INTO gastos_diarios (ot_id, fecha, clasificacion, detalle, cantidad, valor_neto, valor_iva, valor_total)
        VALUES (?, ?, 'INSUMOS', ?, ?, ?, ?, ?)
      `, [ot_id, fecha, `[ SKU: ${sku} ] ${item.descripcion}`, parseFloat(cantidad), net, iva, total]);
    }

    res.json({ message: 'Movimiento registrado con éxito', stock: newStock });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ACTIVOS (EQUIPOS Y HERRAMIENTAS) ---
app.get('/api/activos', authenticate, async (req, res) => {
  try {
    const acts = await query(`
      SELECT a.*, t.nombre as asignado_nombre 
      FROM activos a
      LEFT JOIN trabajadores t ON a.asignado_a_trabajador_id = t.id
      ORDER BY a.id ASC
    `);
    res.json(acts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/activos', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { nombre, descripcion, tipo, ubicacion, proveedor, valor_compra, garantia_vencimiento, condicion, cantidad, modelo, observaciones } = req.body;
  if (!nombre) {
    return res.status(400).json({ message: 'El nombre es obligatorio' });
  }
  try {
    await run(`
      INSERT INTO activos (nombre, descripcion, tipo, ubicacion, proveedor, valor_compra, garantia_vencimiento, condicion, cantidad, modelo, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [nombre, descripcion, tipo, ubicacion, proveedor, parseFloat(valor_compra) || 0.0, garantia_vencimiento, condicion, parseInt(cantidad) || 1, modelo, observaciones]);
    res.status(201).json({ message: 'Activo creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/activos/:id', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, tipo, ubicacion, proveedor, valor_compra, garantia_vencimiento, condicion, cantidad, modelo, observaciones, asignado_a_trabajador_id, asignado_a_ot_id } = req.body;
  try {
    await run(`
      UPDATE activos 
      SET nombre = ?, descripcion = ?, tipo = ?, ubicacion = ?, proveedor = ?, valor_compra = ?, garantia_vencimiento = ?, condicion = ?, cantidad = ?, modelo = ?, observaciones = ?, asignado_a_trabajador_id = ?, asignado_a_ot_id = ?
      WHERE id = ?
    `, [nombre, descripcion, tipo, ubicacion, proveedor, parseFloat(valor_compra) || 0.0, garantia_vencimiento, condicion, parseInt(cantidad) || 1, modelo, observaciones, asignado_a_trabajador_id ? parseInt(asignado_a_trabajador_id) : null, asignado_a_ot_id || null, id]);
    res.json({ message: 'Activo actualizado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- COTIZACIONES ---
app.get('/api/cotizaciones', authenticate, async (req, res) => {
  try {
    const cots = await query(`
      SELECT cot.*, cl.razon_social as cliente_nombre 
      FROM cotizaciones cot
      JOIN clientes cl ON cot.cliente_id = cl.id
      ORDER BY cot.id DESC
    `);
    res.json(cots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cotizaciones', authenticate, checkRole(['admin']), async (req, res) => {
  const { cliente_id, detalle, monto_neto_presupuesto, utilidad_porcentaje, hh_estimadas, materiales_estimados, terceros_estimados } = req.body;
  if (!cliente_id || !detalle) {
    return res.status(400).json({ message: 'Cliente y detalle son obligatorios' });
  }
  try {
    await run(`
      INSERT INTO cotizaciones (cliente_id, detalle, monto_neto_presupuesto, utilidad_porcentaje, hh_estimadas, materiales_estimados, terceros_estimados, fecha_creacion, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CREADA')
    `, [parseInt(cliente_id), detalle, parseFloat(monto_neto_presupuesto) || 0.0, parseFloat(utilidad_porcentaje) || 25.0, typeof hh_estimadas === 'string' ? hh_estimadas : JSON.stringify(hh_estimadas || []), typeof materiales_estimados === 'string' ? materiales_estimados : JSON.stringify(materiales_estimados || []), parseFloat(terceros_estimados) || 0.0, new Date().toISOString().split('T')[0]]);
    res.status(201).json({ message: 'Cotización creada con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cotizaciones/:id/estado', authenticate, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { estado, ot_id } = req.body; // CREADA, APROBADA, RECHAZADA
  try {
    const cot = await get('SELECT * FROM cotizaciones WHERE id = ?', [id]);
    if (!cot) {
      return res.status(404).json({ message: 'Cotización no encontrada' });
    }

    if (estado === 'APROBADA' && cot.estado !== 'APROBADA') {
      const activeOtId = ot_id || `OT-${Math.floor(1000 + Math.random() * 9000)}`;
      
      // Crear la OT automáticamente en la tabla ordenes_trabajo
      await run(`
        INSERT INTO ordenes_trabajo (id, cliente_id, usuario_id, detalle, estado, es_emergencia, recargo_emergencia, fecha_solicitud, monto_neto_presupuesto)
        VALUES (?, ?, ?, ?, 'SP', 0, 0.0, ?, ?)
      `, [activeOtId, cot.cliente_id, req.user.id, `[COT-${id}] ${cot.detalle}`, new Date().toISOString().split('T')[0], cot.monto_neto_presupuesto]);
      
      await run('UPDATE cotizaciones SET estado = ?, ot_creada_id = ? WHERE id = ?', ['APROBADA', activeOtId, id]);
      return res.json({ message: 'Cotización aprobada y OT creada con éxito', ot_id: activeOtId });
    }

    await run('UPDATE cotizaciones SET estado = ? WHERE id = ?', [estado, id]);
    res.json({ message: 'Estado de cotización actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- INFORMES TÉCNICOS ---
app.get('/api/informes/ot/:ot_id', authenticate, async (req, res) => {
  const { ot_id } = req.params;
  try {
    const inf = await get('SELECT * FROM informes_tecnicos WHERE ot_id = ?', [ot_id]);
    res.json(inf || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/informes/ot/:ot_id', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { ot_id } = req.params;
  const { antes_condicion, despues_tareas, recomendaciones, fotos_antes, fotos_despues } = req.body;
  try {
    const existing = await get('SELECT id FROM informes_tecnicos WHERE ot_id = ?', [ot_id]);
    if (existing) {
      await run(`
        UPDATE informes_tecnicos 
        SET antes_condicion = ?, despues_tareas = ?, recomendaciones = ?, fotos_antes = ?, fotos_despues = ?
        WHERE ot_id = ?
      `, [antes_condicion, despues_tareas, recomendaciones, typeof fotos_antes === 'string' ? fotos_antes : JSON.stringify(fotos_antes || []), typeof fotos_despues === 'string' ? fotos_despues : JSON.stringify(fotos_despues || []), ot_id]);
    } else {
      await run(`
        INSERT INTO informes_tecnicos (ot_id, antes_condicion, despues_tareas, recomendaciones, fotos_antes, fotos_despues)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [ot_id, antes_condicion, despues_tareas, recomendaciones, typeof fotos_antes === 'string' ? fotos_antes : JSON.stringify(fotos_antes || []), typeof fotos_despues === 'string' ? fotos_despues : JSON.stringify(fotos_despues || [])]);
    }
    res.json({ message: 'Informe técnico guardado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Server (sólo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Servidor local corriendo en http://localhost:${PORT}`);
  });
}

export default app;
