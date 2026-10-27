// ping de diagnóstico en Vercel: /api/ping
module.exports = (req, res) => {
  res.json({
    ok: true,
    vercel: true,
    node: process.version,
    tursoConfigurado: Boolean(process.env.TURSO_DATABASE_URL),
    region: process.env.VERCEL_REGION || 'desconocida',
  });
};
