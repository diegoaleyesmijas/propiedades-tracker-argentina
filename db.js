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

module.exports = db;
