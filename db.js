const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'propiedades.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS propiedades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,
  titulo TEXT,
  precio TEXT,
  m2 TEXT,
  ambientes TEXT,
  direccion TEXT,
  foto_url TEXT,
  estado TEXT DEFAULT 'interes',     -- interes | descartada | visitada | nueva
  notas TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  origen TEXT,
  fecha_agregada TEXT DEFAULT (CURRENT_TIMESTAMP),
  fecha_actualizada TEXT DEFAULT (CURRENT_TIMESTAMP),
  fecha_visita TEXT
);
`);

// migraciones simples: agregar columnas si faltan
function addCol(name, ddl) {
  const cols = db.prepare(`PRAGMA table_info(propiedades)`).all().map(c => c.name);
  if (!cols.includes(name)) db.exec(`ALTER TABLE propiedades ADD COLUMN ${ddl}`);
}
addCol('expensas', `expensas TEXT`);
addCol('visitada', `visitada INTEGER DEFAULT 0`);

// migrar estado viejo "visitada" a la nueva dimensión separada
db.exec(`UPDATE propiedades SET visitada = 1, estado = 'interes' WHERE estado = 'visitada' AND visitada = 0`);

module.exports = db;
