const { migrate } = require('../store');
const app = require('../index');

// serverless: migrar/crear esquema una vez por backend (warm start)
let ready = null;
const ensure = () => { ready = ready || migrate(); return ready; };

module.exports = (req, res) => {
  ensure().then(() => app(req, res)).catch(e => {
    console.error(e);
    res.status(500).json({ error: e.message || 'error interno' });
  });
};
