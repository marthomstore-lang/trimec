import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { get, run, query, initDb } from './db.js';
import { generateBudgetPDF, generateTechnicalReportPDF } from './pdfGenerator.js';
import { createClient } from '@supabase/supabase-js';
import { createDriveFolder, uploadFileToDrive, deleteFileFromDrive } from './googleDrive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar cliente Supabase si las credenciales están disponibles
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'trimec_secret_key_12345';

// Limites de Frecuencia (Rate Limiting)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: 'Demasiados intentos de inicio de sesión. Por favor, reintente en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { message: 'Límite de solicitudes al servidor superado. Reintente en un momento.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Cabeceras de Seguridad HTTP (Security Headers)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Configuración de CORS Seguro
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5000').split(',');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !isProd || allowedOrigins.includes(origin) || allowedOrigins.some(o => origin.endsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error('Petición bloqueada por política de CORS.'));
    }
  },
  credentials: true,
}));

app.use('/api/', apiLimiter);
app.use(express.json({ limit: '10mb' }));
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
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Por favor, ingrese su correo electrónico y contraseña' });
  }
  const cleanEmail = email.trim().toLowerCase();
  try {
    const user = await get('SELECT * FROM usuarios WHERE LOWER(email) = ?', [cleanEmail]);
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
  const { prefijo } = req.query;
  const prefixToUse = (prefijo || 'OT').trim().toUpperCase();

  try {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = String(today.getFullYear()).slice(-2);
    const datePrefix = `${dd}${mm}${yy}`; // Formato DDMMYY

    const ots = await query(`SELECT id FROM ordenes_trabajo`);
    
    let maxSeq = 0;
    const regex = new RegExp(`${datePrefix}\\.(\\d+)`);
    
    if (ots && ots.length > 0) {
      for (const ot of ots) {
        const match = ot.id.toString().match(regex);
        if (match) {
          const seqVal = parseInt(match[1], 10);
          if (!isNaN(seqVal) && seqVal > maxSeq) {
            maxSeq = seqVal;
          }
        }
      }
    }
    
    let nextSeq = maxSeq + 1;
    let finalNumber = `${datePrefix}.${nextSeq}`;
    let proposedId = `${prefixToUse}-${finalNumber}`;

    // Validar en bucle si el ID final ya existe (por si se generaron descalces manuales)
    let exists = true;
    while (exists) {
      const existing = await get('SELECT id FROM ordenes_trabajo WHERE id = ?', [proposedId]);
      if (existing) {
        nextSeq++;
        finalNumber = `${datePrefix}.${nextSeq}`;
        proposedId = `${prefixToUse}-${finalNumber}`;
      } else {
        exists = false;
      }
    }
    
    res.json({ siguiente_numero: finalNumber, id_propuesto: proposedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener lista de OTs con sus costos agregados y márgenes
app.get('/api/ots', authenticate, async (req, res) => {
  try {
    let whereClause = '';
    if (req.user && req.user.rol === 'supervisor') {
      whereClause = "WHERE o.estado IN ('En Ejecución', 'Presupuestada', 'Aprobada', 'En Proceso')";
    }
    const ots = await query(`
      SELECT o.*, c.razon_social as cliente_nombre 
      FROM ordenes_trabajo o 
      JOIN clientes c ON o.cliente_id = c.id
      ${whereClause}
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
    // Obtener razón social del cliente para nombrar la carpeta de Drive
    const clientRecord = await get('SELECT razon_social FROM clientes WHERE id = ?', [cliente_id]);
    const clientName = clientRecord ? clientRecord.razon_social : '';
    const folderName = `OT ${id} - ${clientName}`.trim();

    // Crear carpeta en Google Drive (retorna la URL o null si no está configurada la cuenta de servicio)
    const driveFolderUrl = await createDriveFolder(folderName);

    await run(
      `INSERT INTO ordenes_trabajo 
      (id, cliente_id, usuario_id, detalle, estado, es_emergencia, recargo_emergencia, fecha_solicitud, fecha_aprobacion, fecha_entrega, monto_neto_presupuesto, hh_presupuestadas, fecha_proyectada_presupuesto, drive_folder_url) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cliente_id, req.user.id, detalle, estado || 'SP', es_emergencia ? 1 : 0, recargo_emergencia || 0.0, fecha_solicitud, fecha_aprobacion, fecha_entrega, monto_neto_presupuesto || 0.0, hh_presupuestadas || 0.0, fecha_proyectada_presupuesto || null, driveFolderUrl || null]
    );

    // Crear registro vacío de facturación
    await run('INSERT INTO facturacion (ot_id) VALUES (?) ON CONFLICT DO NOTHING', [id]);

    res.status(201).json({ id, drive_folder_url: driveFolderUrl, message: 'OT creada con éxito y carpeta de Drive vinculada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/ots/:id', authenticate, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const ot = await get('SELECT * FROM ordenes_trabajo WHERE id = ?', [id]);
    if (!ot) {
      return res.status(404).json({ error: 'Orden de Trabajo no encontrada' });
    }

    await run('DELETE FROM registro_hh WHERE ot_id = ?', [id]);
    await run('DELETE FROM gastos_diarios WHERE ot_id = ?', [id]);
    await run('DELETE FROM facturacion WHERE ot_id = ?', [id]);
    await run('DELETE FROM archivos_ot WHERE ot_id = ?', [id]);
    await run('DELETE FROM traslados_viajes WHERE ot_id = ?', [id]);
    await run('DELETE FROM informes_tecnicos WHERE ot_id = ?', [id]);
    await run('DELETE FROM ordenes_trabajo WHERE id = ?', [id]);

    res.json({ message: 'Orden de Trabajo eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ots/:id/crear-carpeta-drive', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { id } = req.params;
  try {
    const ot = await get(`
      SELECT o.*, c.razon_social 
      FROM ordenes_trabajo o
      JOIN clientes c ON o.cliente_id = c.id
      WHERE o.id = ?
    `, [id]);

    if (!ot) {
      return res.status(404).json({ error: 'Orden de Trabajo no encontrada' });
    }

    if (ot.drive_folder_url) {
      return res.json({ drive_folder_url: ot.drive_folder_url, message: 'La carpeta ya existe' });
    }

    const folderName = `OT ${id} - ${ot.razon_social || ''}`.trim();
    const driveFolderUrl = await createDriveFolder(folderName);

    if (!driveFolderUrl) {
      return res.status(500).json({ error: 'No se pudo crear la carpeta en Google Drive. Verifica que la carpeta raíz esté compartida con la cuenta de servicio y las credenciales del .env sean válidas.' });
    }

    await run('UPDATE ordenes_trabajo SET drive_folder_url = ? WHERE id = ?', [driveFolderUrl, id]);

    res.json({ drive_folder_url: driveFolderUrl, message: 'Carpeta de Drive creada y vinculada con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/ots/:id', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  
  try {
    const otExisting = await get('SELECT * FROM ordenes_trabajo WHERE id = ?', [id]);
    if (!otExisting) {
      return res.status(404).json({ error: 'OT no encontrada' });
    }

    const nuevo_id = body.nuevo_id;
    const targetId = (nuevo_id && nuevo_id !== id) ? nuevo_id : id;

    if (nuevo_id && nuevo_id !== id) {
      const existing = await get('SELECT id FROM ordenes_trabajo WHERE id = ?', [nuevo_id]);
      if (existing) {
        return res.status(400).json({ message: 'El nuevo número de OT ya existe.' });
      }
      
      await run('UPDATE registro_hh SET ot_id = ? WHERE ot_id = ?', [nuevo_id, id]);
      await run('UPDATE gastos_diarios SET ot_id = ? WHERE ot_id = ?', [nuevo_id, id]);
      await run('UPDATE facturacion SET ot_id = ? WHERE ot_id = ?', [nuevo_id, id]);
      await run('UPDATE archivos_ot SET ot_id = ? WHERE ot_id = ?', [nuevo_id, id]);
      await run('UPDATE activos SET asignado_a_ot_id = ? WHERE asignado_a_ot_id = ?', [nuevo_id, id]);
      await run('UPDATE informes_tecnicos SET ot_id = ? WHERE ot_id = ?', [nuevo_id, id]);
      await run('UPDATE inventario_movimientos SET ot_id = ? WHERE ot_id = ?', [nuevo_id, id]);
    }

    const updatedClienteId = body.cliente_id !== undefined ? body.cliente_id : otExisting.cliente_id;
    const updatedDetalle = body.detalle !== undefined ? body.detalle : otExisting.detalle;
    const updatedEstado = body.estado !== undefined ? body.estado : otExisting.estado;
    const updatedEsEmergencia = body.es_emergencia !== undefined ? (body.es_emergencia ? 1 : 0) : otExisting.es_emergencia;
    const updatedRecargo = body.recargo_emergencia !== undefined ? body.recargo_emergencia : otExisting.recargo_emergencia;
    const updatedFechaSolicitud = body.fecha_solicitud !== undefined ? body.fecha_solicitud : otExisting.fecha_solicitud;
    const updatedFechaAprobacion = body.fecha_aprobacion !== undefined ? body.fecha_aprobacion : otExisting.fecha_aprobacion;
    const updatedFechaEntrega = body.fecha_entrega !== undefined ? body.fecha_entrega : otExisting.fecha_entrega;
    const updatedMontoNeto = body.monto_neto_presupuesto !== undefined ? body.monto_neto_presupuesto : otExisting.monto_neto_presupuesto;
    const updatedHhPresup = body.hh_presupuestadas !== undefined ? body.hh_presupuestadas : otExisting.hh_presupuestadas;
    const updatedFechaProj = body.fecha_proyectada_presupuesto !== undefined ? body.fecha_proyectada_presupuesto : otExisting.fecha_proyectada_presupuesto;
    const updatedFechaEnvio = body.fecha_envio_presupuesto !== undefined ? body.fecha_envio_presupuesto : otExisting.fecha_envio_presupuesto;
    const updatedNotas = body.notas_presupuesto !== undefined ? body.notas_presupuesto : otExisting.notas_presupuesto;
    const updatedFaena = body.faena !== undefined ? body.faena : otExisting.faena;

    await run(
      `UPDATE ordenes_trabajo 
       SET id = ?, cliente_id = ?, detalle = ?, estado = ?, es_emergencia = ?, recargo_emergencia = ?, fecha_solicitud = ?, fecha_aprobacion = ?, fecha_entrega = ?, monto_neto_presupuesto = ?, hh_presupuestadas = ?, fecha_proyectada_presupuesto = ?, fecha_envio_presupuesto = ?, notas_presupuesto = ?, faena = ?
       WHERE id = ?`,
      [targetId, updatedClienteId, updatedDetalle, updatedEstado, updatedEsEmergencia, updatedRecargo, updatedFechaSolicitud, updatedFechaAprobacion, updatedFechaEntrega, updatedMontoNeto, updatedHhPresup, updatedFechaProj, updatedFechaEnvio, updatedNotas, updatedFaena, id]
    );

    res.json({ message: 'OT actualizada con éxito', nuevo_id: targetId });
  } catch (error) {
    console.error('Error al actualizar OT:', error);
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

const checkOtNotLocked = async (otId) => {
  if (!otId) return { locked: false };
  const ot = await get('SELECT estado FROM ordenes_trabajo WHERE id = ?', [otId]);
  if (!ot) return { locked: false };
  const lockedStates = ['LIQ', 'Liquidada', 'FAC', 'Facturada', 'CER', 'Cerrada'];
  if (lockedStates.includes(ot.estado)) {
    return { locked: true, estado: ot.estado };
  }
  return { locked: false, estado: ot.estado };
};

app.post('/api/hh', authenticate, checkRole(['admin', 'supervisor', 'operador']), async (req, res) => {
  const { ot_id, trabajador_id, fecha, horas_normales, horas_extra, ubicacion, actividad } = req.body;
  try {
    const lockCheck = await checkOtNotLocked(ot_id);
    if (lockCheck.locked) {
      return res.status(400).json({ error: `La OT ${ot_id} se encuentra en estado '${lockCheck.estado}' y no permite nuevos ingresos.` });
    }

    const result = await run(
      'INSERT INTO registro_hh (ot_id, trabajador_id, fecha, horas_normales, horas_extra, ubicacion, actividad) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [ot_id, trabajador_id, fecha, horas_normales || 0.0, horas_extra || 0.0, ubicacion || 'Taller', actividad]
    );
    res.status(201).json({ id: result.id, message: 'Registro de horas creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/hh/:id', authenticate, checkRole(['admin', 'supervisor', 'operador']), async (req, res) => {
  const { id } = req.params;
  const { ot_id, trabajador_id, fecha, horas_normales, horas_extra, ubicacion, actividad } = req.body;
  try {
    await run(
      `UPDATE registro_hh 
       SET ot_id = ?, trabajador_id = ?, fecha = ?, horas_normales = ?, horas_extra = ?, ubicacion = ?, actividad = ?
       WHERE id = ?`,
      [ot_id, trabajador_id, fecha, parseFloat(horas_normales) || 0.0, parseFloat(horas_extra) || 0.0, ubicacion || 'Taller', actividad, id]
    );
    res.json({ message: 'Registro de horas actualizado' });
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

app.post('/api/gastos', authenticate, checkRole(['admin', 'supervisor', 'operador']), async (req, res) => {
  const { ot_id, fecha, clasificacion, detalle, cantidad, valor_neto, valor_iva, valor_total, foto_boleta } = req.body;
  try {
    const lockCheck = await checkOtNotLocked(ot_id);
    if (lockCheck.locked) {
      return res.status(400).json({ error: `La OT ${ot_id} se encuentra en estado '${lockCheck.estado}' y no permite nuevos ingresos.` });
    }

    const result = await run(
      'INSERT INTO gastos_diarios (ot_id, fecha, clasificacion, detalle, cantidad, valor_neto, valor_iva, valor_total, foto_boleta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [ot_id, fecha, clasificacion, detalle, cantidad || 1.0, valor_neto || 0.0, valor_iva || 0.0, valor_total || 0.0, foto_boleta || null]
    );
    res.status(201).json({ id: result.id, message: 'Gasto registrado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/gastos/:id', authenticate, checkRole(['admin', 'supervisor', 'operador']), async (req, res) => {
  const { id } = req.params;
  const { ot_id, fecha, clasificacion, detalle, cantidad, valor_neto, valor_iva, valor_total, foto_boleta } = req.body;
  try {
    const net = parseFloat(valor_neto) || 0.0;
    const iva = valor_iva !== undefined ? parseFloat(valor_iva) : net * 0.19;
    const total = valor_total !== undefined ? parseFloat(valor_total) : net + iva;
    await run(
      `UPDATE gastos_diarios 
       SET ot_id = ?, fecha = ?, clasificacion = ?, detalle = ?, cantidad = ?, valor_neto = ?, valor_iva = ?, valor_total = ?, foto_boleta = ?
       WHERE id = ?`,
      [ot_id, fecha, clasificacion, detalle, parseFloat(cantidad) || 1.0, net, iva, total, foto_boleta || null, id]
    );
    res.json({ message: 'Gasto actualizado con éxito' });
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


// --- TRASLADOS Y VIAJES ROUTES ---
app.get('/api/traslados/ot/:ot_id', authenticate, async (req, res) => {
  const { ot_id } = req.params;
  try {
    const travels = await query(`
      SELECT tv.*, t.nombre as trabajador_nombre, t.rol as trabajador_rol
      FROM traslados_viajes tv
      JOIN trabajadores t ON tv.trabajador_id = t.id
      WHERE tv.ot_id = ?
      ORDER BY tv.fecha DESC, tv.id DESC
    `, [ot_id]);
    res.json(travels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/traslados', authenticate, checkRole(['admin', 'supervisor', 'operador']), async (req, res) => {
  const {
    ot_id,
    trabajador_id,
    fecha,
    patente_vehiculo,
    km_inicio,
    km_termino,
    hora_salida_taller,
    hora_llegada_faena,
    hora_salida_faena,
    hora_llegada_taller,
    detalle_viaje
  } = req.body;

  try {
    const lockCheck = await checkOtNotLocked(ot_id);
    if (lockCheck.locked) {
      return res.status(400).json({ error: `La OT ${ot_id} se encuentra en estado '${lockCheck.estado}' y no permite nuevos ingresos.` });
    }
    const result = await run(`
      INSERT INTO traslados_viajes (
        ot_id, trabajador_id, fecha, patente_vehiculo, km_inicio, km_termino,
        hora_salida_taller, hora_llegada_faena, hora_salida_faena, hora_llegada_taller, detalle_viaje
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ot_id,
      trabajador_id,
      fecha,
      patente_vehiculo,
      parseFloat(km_inicio) || 0.0,
      parseFloat(km_termino) || 0.0,
      hora_salida_taller || null,
      hora_llegada_faena || null,
      hora_salida_faena || null,
      hora_llegada_taller || null,
      detalle_viaje || null
    ]);
    res.status(201).json({ id: result.id, message: 'Traslado registrado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/traslados/:id', authenticate, checkRole(['admin', 'supervisor', 'operador']), async (req, res) => {
  const { id } = req.params;
  const {
    ot_id,
    trabajador_id,
    fecha,
    patente_vehiculo,
    km_inicio,
    km_termino,
    hora_salida_taller,
    hora_llegada_faena,
    hora_salida_faena,
    hora_llegada_taller,
    detalle_viaje
  } = req.body;

  try {
    await run(`
      UPDATE traslados_viajes 
      SET ot_id = ?, trabajador_id = ?, fecha = ?, patente_vehiculo = ?, km_inicio = ?, km_termino = ?,
          hora_salida_taller = ?, hora_llegada_faena = ?, hora_salida_faena = ?, hora_llegada_taller = ?, detalle_viaje = ?
      WHERE id = ?
    `, [
      ot_id,
      trabajador_id,
      fecha,
      patente_vehiculo,
      parseFloat(km_inicio) || 0.0,
      parseFloat(km_termino) || 0.0,
      hora_salida_taller || null,
      hora_llegada_faena || null,
      hora_salida_faena || null,
      hora_llegada_taller || null,
      detalle_viaje || null,
      id
    ]);
    res.json({ message: 'Traslado actualizado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/traslados/:id', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { id } = req.params;
  try {
    await run('DELETE FROM traslados_viajes WHERE id = ?', [id]);
    res.json({ message: 'Traslado eliminado' });
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
      SELECT SUBSTR(o.fecha_solicitud, 1, 7) as mes, SUM(o.monto_neto_presupuesto) as total_ingreso
      FROM ordenes_trabajo o
      JOIN facturacion f ON f.ot_id = o.id
      WHERE f.nro_factura IS NOT NULL AND f.nro_factura != '' AND f.estado_pago != 'Anulado'
      GROUP BY mes
    `);

    // 2. Egresos Fijos de Gastos Generales
    const egresosFijos = await query(`
      SELECT SUBSTR(fecha, 1, 7) as mes, SUM(valor_total) as total_egreso_fijo
      FROM gastos_generales
      GROUP BY mes
    `);

    // 3. Egresos Variables de OTs (Materiales y Comidas de OTs activas)
    const egresosOTs = await query(`
      SELECT SUBSTR(fecha, 1, 7) as mes, SUM(valor_neto) as total_egreso_ot
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
    let targetMonth = req.query.mes;
    if (!targetMonth || targetMonth === 'null' || targetMonth === 'undefined') {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const checkCurrent = await get(`SELECT COUNT(*) as count FROM registro_hh WHERE SUBSTR(fecha, 1, 7) = ?`, [currentMonth]);
      if (checkCurrent && parseInt(checkCurrent.count) > 0) {
        targetMonth = currentMonth;
      } else {
        const latestRecord = await get(`SELECT SUBSTR(fecha, 1, 7) as mes FROM registro_hh ORDER BY fecha DESC LIMIT 1`);
        targetMonth = latestRecord && latestRecord.mes ? latestRecord.mes : currentMonth;
      }
    }

    const workers = await query('SELECT * FROM trabajadores ORDER BY nombre ASC');
    
    const performance = await Promise.all(
      workers.map(async (w) => {
        let hoursSummary;
        let breakdown;

        if (targetMonth === 'TODOS' || targetMonth === 'todos') {
          hoursSummary = await get(`
            SELECT SUM(horas_normales + horas_extra) as total_horas 
            FROM registro_hh 
            WHERE trabajador_id = ?
          `, [w.id]);

          breakdown = await query(`
            SELECT r.ot_id, o.detalle as ot_detalle, SUM(r.horas_normales + r.horas_extra) as horas_ot
            FROM registro_hh r
            JOIN ordenes_trabajo o ON r.ot_id = o.id
            WHERE r.trabajador_id = ?
            GROUP BY r.ot_id, o.detalle
          `, [w.id]);
        } else {
          hoursSummary = await get(`
            SELECT SUM(horas_normales + horas_extra) as total_horas 
            FROM registro_hh 
            WHERE trabajador_id = ? AND SUBSTR(fecha, 1, 7) = ?
          `, [w.id, targetMonth]);

          breakdown = await query(`
            SELECT r.ot_id, o.detalle as ot_detalle, SUM(r.horas_normales + r.horas_extra) as horas_ot
            FROM registro_hh r
            JOIN ordenes_trabajo o ON r.ot_id = o.id
            WHERE r.trabajador_id = ? AND SUBSTR(r.fecha, 1, 7) = ?
            GROUP BY r.ot_id, o.detalle
          `, [w.id, targetMonth]);
        }

        return {
          id: w.id,
          nombre: w.nombre,
          rol: w.rol,
          horas_mensuales_esperadas: w.horas_mensuales_esperadas || 168.0,
          horas_reales: hoursSummary ? (hoursSummary.total_horas || 0) : 0,
          desglose: breakdown || [],
          mes_calculado: targetMonth
        };
      })
    );
    
    res.json(performance);
  } catch (error) {
    console.error('Error en rendimiento-personal:', error);
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

    // Obtener desglose de mano de obra (HH) y gastos/materiales
    const hhList = await query(`
      SELECT r.*, t.nombre as trabajador_nombre, t.rol as trabajador_rol,
             ((r.horas_normales * t.valor_hh_normal) + (r.horas_extra * t.valor_hh_extra)) as costo_calculado
      FROM registro_hh r
      JOIN trabajadores t ON r.trabajador_id = t.id
      WHERE r.ot_id = ?
      ORDER BY r.fecha ASC
    `, [id]);

    const expensesList = await query(`
      SELECT clasificacion, detalle, cantidad, valor_neto, valor_total 
      FROM gastos_diarios 
      WHERE ot_id = ?
      ORDER BY fecha ASC
    `, [id]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=presupuesto-ot-${id}.pdf`);

    generateBudgetPDF(ot, client, { hhList, expensesList }, res);
  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).send('Error interno al generar el PDF del presupuesto.');
  }
});

app.get('/api/ots/:id/informe-pdf', async (req, res) => {
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

    const report = await get('SELECT * FROM informes_tecnicos WHERE ot_id = ?', [id]);

    const travelList = await query(`
      SELECT tv.*, t.nombre as trabajador_nombre, t.rol as trabajador_rol
      FROM traslados_viajes tv
      JOIN trabajadores t ON tv.trabajador_id = t.id
      WHERE tv.ot_id = ?
      ORDER BY tv.fecha ASC, tv.id ASC
    `, [id]);

    const hhList = await query(`
      SELECT r.*, t.nombre as trabajador_nombre, t.rol as trabajador_rol
      FROM registro_hh r
      JOIN trabajadores t ON r.trabajador_id = t.id
      WHERE r.ot_id = ?
      ORDER BY r.fecha ASC
    `, [id]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=informe-tecnico-ot-${id}.pdf`);

    generateTechnicalReportPDF(ot, client, report, { travelList, hhList }, res);
  } catch (error) {
    console.error('Error al generar PDF de Informe Técnico:', error);
    res.status(500).send('Error interno al generar el PDF del informe técnico.');
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
    let uploadSuccess = false;

    // 1. Intentar subir a la carpeta específica de Google Drive si la OT la tiene
    try {
      const otRecord = await get('SELECT drive_folder_url FROM ordenes_trabajo WHERE id = ?', [otId]);
      if (otRecord && otRecord.drive_folder_url) {
        const folderIdMatch = otRecord.drive_folder_url.match(/\/folders\/([a-zA-Z0-9-_]+)/);
        const folderId = folderIdMatch ? folderIdMatch[1] : null;
        if (folderId) {
          console.log(`Subiendo archivo a la carpeta de Drive de la OT: ${folderId}`);
          const driveFileUrl = await uploadFileToDrive(folderId, filename, filetype, buffer);
          if (driveFileUrl) {
            storedIdentifier = driveFileUrl;
            uploadSuccess = true;
            console.log(`Archivo subido con éxito a Google Drive: ${driveFileUrl}`);
          }
        }
      }
    } catch (driveErr) {
      console.error('Error al intentar subir archivo a Google Drive (fallando a almacenamiento por defecto):', driveErr.message || driveErr);
    }

    // 2. Si no se subió a Drive, usar el almacenamiento tradicional (Supabase o local) como fallback
    if (!uploadSuccess) {
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
    }
    
    const now = new Date().toISOString().split('T')[0];
    await run(
      'INSERT INTO archivos_ot (ot_id, nombre_original, nombre_guardado, tipo, fecha_subida) VALUES (?, ?, ?, ?, ?)',
      [otId, filename, storedIdentifier, filetype, now]
    );
    
    res.status(201).json({ message: 'Archivo subido con éxito', filenameUnique, drive: uploadSuccess });
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
    
    if (isUrl && file.nombre_guardado.includes('drive.google.com')) {
      // Es un archivo de Google Drive
      const fileIdMatch = file.nombre_guardado.match(/\/file\/d\/([a-zA-Z0-9-_]+)/) || file.nombre_guardado.match(/id=([a-zA-Z0-9-_]+)/);
      const fileId = fileIdMatch ? fileIdMatch[1] : null;
      if (fileId) {
        console.log(`Eliminando archivo de Google Drive: ${fileId}`);
        await deleteFileFromDrive(fileId);
      }
    } else if (isUrl && supabase) {
      // Es un archivo de Supabase Storage
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
  const { sku, old_sku, descripcion, proveedor, fecha_ultimo_pedido, stock, ubicacion, valor_unitario, stock_minimo, familia, unidad_medida } = req.body;
  if (!sku || !descripcion) {
    return res.status(400).json({ message: 'SKU y descripción son obligatorios' });
  }
  try {
    const cleanSku = String(sku).trim();
    const cleanOldSku = old_sku ? String(old_sku).trim() : null;

    const stockVal = stock !== undefined && stock !== null && stock !== '' ? parseFloat(stock) : 0.0;
    const valorVal = valor_unitario !== undefined && valor_unitario !== null && valor_unitario !== '' ? parseFloat(valor_unitario) : 0.0;
    const minVal = stock_minimo !== undefined && stock_minimo !== null && stock_minimo !== '' ? parseFloat(stock_minimo) : 10.0;

    const safeStock = isNaN(stockVal) ? 0.0 : stockVal;
    const safeValor = isNaN(valorVal) ? 0.0 : valorVal;
    const safeMin = isNaN(minVal) ? 10.0 : minVal;
    const safeProv = proveedor || null;
    const safeFecha = fecha_ultimo_pedido || null;
    const safeUbic = ubicacion || null;
    const safeFam = familia || null;
    const safeUni = unidad_medida || null;

    // Si cambió el SKU al editar
    if (cleanOldSku && cleanOldSku !== cleanSku) {
      await run('UPDATE inventario_movimientos SET sku = ? WHERE sku = ?', [cleanSku, cleanOldSku]);
      await run('DELETE FROM inventario WHERE sku = ?', [cleanOldSku]);
    }

    const existing = await get('SELECT sku FROM inventario WHERE sku = ?', [cleanSku]);

    if (existing) {
      await run(`
        UPDATE inventario 
        SET descripcion = ?, proveedor = ?, fecha_ultimo_pedido = ?, stock = ?, ubicacion = ?, valor_unitario = ?, stock_minimo = ?, familia = ?, unidad_medida = ?
        WHERE sku = ?
      `, [descripcion, safeProv, safeFecha, safeStock, safeUbic, safeValor, safeMin, safeFam, safeUni, cleanSku]);
    } else {
      await run(`
        INSERT INTO inventario (sku, descripcion, proveedor, fecha_ultimo_pedido, stock, ubicacion, valor_unitario, stock_minimo, familia, unidad_medida)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [cleanSku, descripcion, safeProv, safeFecha, safeStock, safeUbic, safeValor, safeMin, safeFam, safeUni]);
    }
    res.json({ sku: cleanSku, descripcion, proveedor: safeProv, fecha_ultimo_pedido: safeFecha, stock: safeStock, ubicacion: safeUbic, valor_unitario: safeValor, stock_minimo: safeMin, familia: safeFam, unidad_medida: safeUni });
  } catch (error) {
    console.error('Error al guardar inventario:', error);
    res.status(500).json({ error: error.message, message: error.message });
  }
});

app.delete('/api/inventario/:sku', authenticate, checkRole(['admin', 'supervisor']), async (req, res) => {
  const { sku } = req.params;
  try {
    const cleanSku = String(sku).trim();
    await run('DELETE FROM inventario_movimientos WHERE sku = ?', [cleanSku]);
    await run('DELETE FROM inventario WHERE sku = ?', [cleanSku]);
    res.json({ message: 'Artículo eliminado de Bodega correctamente' });
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

app.post('/api/informes/ot/:ot_id', authenticate, checkRole(['admin', 'supervisor', 'operador']), async (req, res) => {
  const { ot_id } = req.params;
  const { antes_condicion, despues_tareas, recomendaciones, fotos_antes, fotos_despues, hora_inicio_ejecucion, hora_fin_ejecucion, tecnico_id } = req.body;
  try {
    const existing = await get('SELECT id FROM informes_tecnicos WHERE ot_id = ?', [ot_id]);
    if (existing) {
      await run(`
        UPDATE informes_tecnicos 
        SET antes_condicion = ?, despues_tareas = ?, recomendaciones = ?, fotos_antes = ?, fotos_despues = ?,
            hora_inicio_ejecucion = ?, hora_fin_ejecucion = ?, tecnico_id = ?
        WHERE ot_id = ?
      `, [
        antes_condicion,
        despues_tareas,
        recomendaciones,
        typeof fotos_antes === 'string' ? fotos_antes : JSON.stringify(fotos_antes || []),
        typeof fotos_despues === 'string' ? fotos_despues : JSON.stringify(fotos_despues || []),
        hora_inicio_ejecucion || null,
        hora_fin_ejecucion || null,
        tecnico_id ? parseInt(tecnico_id, 10) : null,
        ot_id
      ]);
    } else {
      await run(`
        INSERT INTO informes_tecnicos (ot_id, antes_condicion, despues_tareas, recomendaciones, fotos_antes, fotos_despues, hora_inicio_ejecucion, hora_fin_ejecucion, tecnico_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        ot_id,
        antes_condicion,
        despues_tareas,
        recomendaciones,
        typeof fotos_antes === 'string' ? fotos_antes : JSON.stringify(fotos_antes || []),
        typeof fotos_despues === 'string' ? fotos_despues : JSON.stringify(fotos_despues || []),
        hora_inicio_ejecucion || null,
        hora_fin_ejecucion || null,
        tecnico_id ? parseInt(tecnico_id, 10) : null
      ]);
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
