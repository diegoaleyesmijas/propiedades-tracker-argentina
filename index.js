const os = require('os');
const fs = require('fs');

const db = require('./db');

const PORT = process.env.PORT || 3000;
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const uploadsDir = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, 'data', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));;

// listar
app.get('/api/propiedades', (req, res) => {
  const { q, estado, tag, orden, visited } = req.query;
  let sql = 'SELECT * FROM propiedades WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (titulo LIKE ? OR notas LIKE ? OR url LIKE ? OR direccion LIKE ? OR tags LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (estado && estado !== 'todas') {
    if (estado === 'sindefinir') sql += " AND (estado IS NULL OR estado = '')";
    else { sql += ' AND estado = ?'; params.push(estado); }
  }
  if (visited === '1' || visited === '0') {
    sql += ' AND visitada = ?';
    params.push(+visited);
  }
  if (tag) {
    sql += ' AND tags LIKE ?';
    params.push(`%${tag}%`);
  }
  if (orden === 'precio') sql += " ORDER BY CAST(REPLACE(REPLACE(precio, '.', ''), '$', '') AS INTEGER) ASC";
  else sql += ' ORDER BY id DESC';
  res.json(db.prepare(sql).all(...params));
});

// crear (alta manual o bookmarklet)
app.post('/api/propiedades', (req, res) => {
  const b = req.body || {};
  if (!b.url) return res.status(400).json({ error: 'falta url' });
  const columns = ['url', 'titulo', 'precio', 'expensas', 'm2', 'ambientes', 'direccion', 'foto_url', 'estado', 'notas', 'tags', 'origen'];
  const values = columns.map(c => b[c]);
  values[columns.indexOf('estado')] = b.estado || 'interes';

  // si ya existe la URL, actualizar datos en vez de duplicar
  const existing = db.prepare('SELECT id FROM propiedades WHERE url = ?').get(b.url);
  if (existing) {
    const sets = columns.map(c => `${c} = COALESCE(?, ${c})`).join(', ');
    db.prepare(`UPDATE propiedades SET ${sets} WHERE id = ?`).run(...values, existing.id);
    return res.json({ id: existing.id, updated: true });
  }
  const info = db.prepare(
    `INSERT INTO propiedades (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`
  ).run(...values);
  res.json({ id: info.lastInsertRowid });
});

// actualizar (estado, notas, tags, edit fields)
app.patch('/api/propiedades/:id', (req, res) => {
  const allowed = ['estado', 'notas', 'tags', 'precio', 'm2', 'ambientes', 'titulo', 'direccion', 'foto_url', 'expensas', 'visitada', 'fecha_visita'];
  const fields = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'nada para actualizar' });
  const sets = fields.map(([k]) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE propiedades SET ${sets}, fecha_actualizada = CURRENT_TIMESTAMP WHERE id = ?`).run(
    ...fields.map(([, v]) => v), req.params.id
  );
  res.json(db.prepare('SELECT * FROM propiedades WHERE id = ?').get(req.params.id));
});

// pegar/subir captura de pantalla -> guarda archivo y apunta foto de la card
app.post('/api/propiedades/:id/foto', (req, res) => {
  const { data } = req.body || {};
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(data || '');
  if (!m) return res.status(400).json({ error: 'dataURL de imagen inválido' });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const file = path.join(uploadsDir, `${req.params.id}.${ext}`);
  fs.writeFileSync(file, Buffer.from(m[2], 'base64'));
  const url = `/uploads/${req.params.id}.${ext}?v=${Date.now()}`;
  db.prepare('UPDATE propiedades SET foto_url = ? WHERE id = ?').run(url, req.params.id);
  res.json({ foto_url: url });
});

app.delete('/api/propiedades/:id', (req, res) => {
  db.prepare('DELETE FROM propiedades WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Trackeo de propiedades en http://localhost:${PORT} (${os.hostname()})`));
