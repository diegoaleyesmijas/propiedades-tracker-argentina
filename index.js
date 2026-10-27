const os = require('os');

const db = require('./db');

const PORT = process.env.PORT || 3000;
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// listar
app.get('/api/propiedades', (req, res) => {
  const { q, estado, tag, orden } = req.query;
  let sql = 'SELECT * FROM propiedades WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (titulo LIKE ? OR notas LIKE ? OR url LIKE ? OR direccion LIKE ? OR tags LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (estado && estado !== 'todas') {
    sql += ' AND estado = ?';
    params.push(estado);
  }
  if (tag) {
    sql += ' AND tags LIKE ?';
    params.push(`%${tag}%`);
  }
  if (orden === 'precio') sql += ' ORDER BY CAST(REPLACE(REPLACE(precio, ".", ""), "$", "") AS INTEGER) ASC';
  else sql += ' ORDER BY id DESC';
  res.json(db.prepare(sql).all(...params));
});

// crear (alta manual o bookmarklet)
app.post('/api/propiedades', (req, res) => {
  const b = req.body || {};
  if (!b.url) return res.status(400).json({ error: 'falta url' });
  const columns = ['url', 'titulo', 'precio', 'm2', 'ambientes', 'direccion', 'foto_url', 'estado', 'notas', 'tags', 'origen'];
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
  const allowed = ['estado', 'notas', 'tags', 'precio', 'm2', 'ambientes', 'titulo', 'direccion', 'foto_url', 'fecha_visita'];
  const fields = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'nada para actualizar' });
  const sets = fields.map(([k]) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE propiedades SET ${sets}, fecha_actualizada = CURRENT_TIMESTAMP WHERE id = ?`).run(
    ...fields.map(([, v]) => v), req.params.id
  );
  res.json(db.prepare('SELECT * FROM propiedades WHERE id = ?').get(req.params.id));
});

app.delete('/api/propiedades/:id', (req, res) => {
  db.prepare('DELETE FROM propiedades WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Trackeo de propiedades en http://localhost:${PORT} (${os.hostname()})`));
