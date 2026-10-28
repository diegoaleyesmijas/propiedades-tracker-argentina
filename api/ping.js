// ping de diagnóstico en Vercel: /api/ping
module.exports = async (req, res) => {
  const out = {
    ok: true,
    vercel: Boolean(process.env.VERCEL),
    node: process.version,
    tursoConfigurado: Boolean(process.env.TURSO_DATABASE_URL),
    region: process.env.VERCEL_REGION || 'desconocida',
  };
  if (out.tursoConfigurado) {
    try {
      const { store } = require('../store');
      const rows = await store.list();
      out.dbDriver = store.kind;
      out.propiedades = rows.length;
      out.dbOk = true;
    } catch (e) {
      out.dbOk = false;
      out.dbError = String(e.message || e).slice(0, 200);
    }
  } else {
    out.dbError = 'TURSO_DATABASE_URL no está configurada en las env vars de Vercel';
  }
  res.json(out);
};
