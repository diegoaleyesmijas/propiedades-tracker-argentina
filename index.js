const path = require('path');
const express = require('express');
const { store, migrate } = require('./store');

const app = express();
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const asyncH = fn => (req, res, next) => fn(req, res, next).catch(next);

// listar
app.get('/api/propiedades', asyncH(async (req, res) => {
  const rows = await store.list({
    q: req.query.q,
    estado: req.query.estado,
    tag: req.query.tag,
    visited: req.query.visited !== undefined ? +req.query.visited : undefined,
    orden: req.query.orden,
  });
  res.json(rows);
}));

// crear (alta manual o bookmarklet)
app.post('/api/propiedades', asyncH(async (req, res) => {
  res.json(await store.upsert(req.body || {}));
}));

// actualizar (estado, notas, tags, expensas, visitada, ...)
app.patch('/api/propiedades/:id', asyncH(async (req, res) => {
  const r = await store.update(req.params.id, req.body || {});
  if (!r) return res.status(404).json({ error: 'no existe' });
  res.json(r);
}));

// subir captura/foto (dataURL base64 → guardada en la base, anda en local y serverless)
app.post('/api/propiedades/:id/foto', asyncH(async (req, res) => {
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec((req.body || {}).data || '');
  const mime = m ? m[1].replace(/^(jpeg)$/, 'image/jpeg') : null;
  if (!m) return res.status(400).json({ error: 'dataURL de imagen inválido' });
  const r = await store.setFoto(req.params.id, m[2], `image/${m[1] === 'jpeg' ? 'jpeg' : m[1]}`);
  res.json({ ok: true, foto_url: `/api/propiedades/${req.params.id}/foto?v=${Date.now()}` });
}));

// servir la foto guardada en la base
app.get('/api/propiedades/:id/foto', asyncH(async (req, res) => {
  const f = await store.getFoto(req.params.id);
  if (!f || !f.foto_blob) return res.status(404).end();
  const buf = Buffer.from(f.foto_blob, 'base64');
  res.setHeader('Content-Type', f.foto_mime || 'image/jpeg');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buf);
}));

app.delete('/api/propiedades/:id', asyncH(async (req, res) => {
  res.json(await store.remove(req.params.id));
}));

// error handler: siempre JSON
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'error interno' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  migrate().then(() => app.listen(PORT, () =>
    console.log(`Trackeo de propiedades en http://localhost:${PORT} (driver: ${store.kind})`)
  ));
}

module.exports = app;
