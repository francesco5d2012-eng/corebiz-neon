const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Asegurar que exista la carpeta public/uploads
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar subida de imágenes con Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Conexión a PostgreSQL Neon (compatible con entorno local y Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_Os5HqJySihx8@ep-empty-sound-b4lc9lre-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// ================= RUTAS DE TEXTOS GENERALES =================
app.get('/api/configuracion', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM configuracion');
    const config = {};
    result.rows.forEach(r => config[r.clave] = r.valor);
    res.json(config);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/configuracion', async (req, res) => {
  try {
    for (const [clave, valor] of Object.entries(req.body)) {
      await pool.query(
        'INSERT INTO configuracion (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = $2',
        [clave, valor]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= RUTAS DE PROYECTOS (CRUD + IMAGEN) =================
app.get('/api/proyectos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.nombre AS categoria_nombre 
      FROM proyectos p LEFT JOIN categorias c ON p.categoria_id = c.id 
      ORDER BY p.id DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/proyectos', upload.single('imagen'), async (req, res) => {
  const { titulo, categoria_id, descripcion_corta, url_demo } = req.body;
  const slug = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
  const imagen_url = req.file ? `uploads/${req.file.filename}` : 'assets/img/portfolio/portfolio-3.webp';
  try {
    await pool.query(
      'INSERT INTO proyectos (titulo, slug, categoria_id, descripcion_corta, imagen_url, url_demo) VALUES ($1, $2, $3, $4, $5, $6)',
      [titulo, slug, categoria_id || 1, descripcion_corta, imagen_url, url_demo]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/proyectos/:id', upload.single('imagen'), async (req, res) => {
  const { id } = req.params;
  const { titulo, categoria_id, descripcion_corta, url_demo, imagen_actual } = req.body;
  const imagen_url = req.file ? `uploads/${req.file.filename}` : imagen_actual;
  try {
    await pool.query(
      'UPDATE proyectos SET titulo=$1, categoria_id=$2, descripcion_corta=$3, imagen_url=$4, url_demo=$5 WHERE id=$6',
      [titulo, categoria_id || 1, descripcion_corta, imagen_url, url_demo, id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/proyectos/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM proyectos WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= RUTAS DE SERVICIOS (CRUD) =================
app.get('/api/servicios', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM servicios ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/servicios', async (req, res) => {
  const { titulo, descripcion, icono } = req.body;
  try {
    await pool.query('INSERT INTO servicios (titulo, descripcion, icono) VALUES ($1, $2, $3)', [titulo, descripcion, icono || 'bi-code-slash']);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/servicios/:id', async (req, res) => {
  const { titulo, descripcion, icono } = req.body;
  try {
    await pool.query('UPDATE servicios SET titulo=$1, descripcion=$2, icono=$3 WHERE id=$4', [titulo, descripcion, icono, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/servicios/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM servicios WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= RUTAS DE CONTACTO =================
app.post('/api/contacto', async (req, res) => {
  const { nombre, email, asunto, mensaje } = req.body;
  try {
    await pool.query('INSERT INTO mensajes_contacto (nombre, email, asunto, mensaje) VALUES ($1, $2, $3, $4)', [nombre, email, asunto, mensaje]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mensajes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mensajes_contacto ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));