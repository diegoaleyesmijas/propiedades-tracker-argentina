// Capa de datos unificada:
// - Turso (libSQL remoto) si están las env vars TURSO_*  → producción (Vercel)
// - SQLite local (better-sqlite3) en cualquier otro caso  → tu máquina
const SCHEMA = `
CREATE TABLE IF NOT EXISTS propiedades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,
  titulo TEXT,
  precio TEXT,
  expensas TEXT,
  m2 TEXT,
  ambientes TEXT,
  direccion TEXT,
  foto_url TEXT,
  foto_blob TEXT,
  foto_mime TEXT,
  estado TEXT DEFAULT 'interes',  -- interes | descartada | (vacio: sin definir)
  visitada INTEGER DEFAULT 0,
  notas TEXT DEFAULT '',
  tags TEXT,
  origen TEXT,
  fecha_agregada TEXT DEFAULT (CURRENT_TIMESTAMP),
  fecha_actualizada TEXT,
  fecha_visita TEXT
);`;

function addCol(cols, name, ddl) {
  if (!cols.includes(name)) return `ALTER TABLE propiedades ADD COLUMN ${ddl};`;
  return null;
}

// migraciones para SQLite viejas (tablas creadas antes de las fotos/visitada)
const MIGRATIONS_KEYS = ['expensas', 'visitada', 'foto_blob', 'foto_mime', 'origen', 'direccion'];
const MIGRATIONS_DDL = {
  expensas: 'expensas TEXT',
  visitada: 'visitada INTEGER DEFAULT 0',
  foto_blob: 'foto_blob TEXT',
  foto_mime: 'foto_mime TEXT',
  origen: 'origen TEXT',
  direccion: 'direccion TEXT',
};

const ALLOWED_FIELDS = ['titulo', 'precio', 'expensas', 'm2', 'ambientes', 'direccion', 'foto_url', 'estado', 'visitada', 'notas', 'tags', 'origen', 'fecha_visita'];

let driver;

if (process.env.TURSO_DATABASE_URL) {
  const libsql = require('@libsql/client');
  const c = libsql.createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  driver = {
    kind: 'turso',
    async all(sql, params = []) {
      const rs = await c.execute({ sql, args: params });
      return rs.rows;
    },
    async run(sql, params = []) {
      const rs = await c.execute({ sql, args: params });
      return { id: Number(rs.lastInsertRowid) };
    },
    async plan() {
      for (const stmt of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
        await c.execute(stmt);
      }
      await this.migrateTurso(c);
    },
    async migrateTurso(c) {
      const cols = (await c.execute('PRAGMA table_info(propiedades)')).rows.map(x => x.name);
      for (const k of MIGRATIONS_KEYS) {
        const ddl = addCol(cols, k, MIGRATIONS_DDL[k]);
        if (ddl) await c.execute(ddl);
      }
      await c.execute(`UPDATE propiedades SET visitada = 1, estado = 'interes' WHERE estado = 'visitada' AND visitada = 0`);
    },
  };
} else {
  const better = require('better-sqlite3');
  const path = require('path');
  const fs = require('fs');
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new better(path.join(dataDir, 'propiedades.db'));
  db.pragma('journal_mode = WAL');
  driver = {
    kind: 'sqlite',
    async all(sql, params = []) { return db.prepare(sql).all(...params); },
    async run(sql, params = []) { return { id: Number(db.prepare(sql).run(...params).lastInsertRowid) }; },
    async plan() {
      db.exec(SCHEMA);
      // migraciones de bases pre-existentes
      const cols = db.prepare('PRAGMA table_info(propiedades)').all().map(x => x.name);
      for (const k of MIGRATIONS_KEYS) {
        const ddl = addCol(cols, k, MIGRATIONS_DDL[k]);
        if (ddl) db.exec(ddl);
      }
      db.exec(`UPDATE propiedades SET visitada = 1, estado = 'interes' WHERE estado = 'visitada' AND visitada = 0`);
    },
  };
}

async function migrate() {
  await driver.plan();
}

// ---------- helpers de query ----------
function where(q, estado, tag, visited) {
  let sql = 'SELECT * FROM propiedades WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (titulo LIKE ? OR notas LIKE ? OR url LIKE ? OR direccion LIKE ? OR tags LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (estado) {
    if (estado === 'sindefinir') sql += " AND (estado IS NULL OR estado = '')";
    else { sql += ' AND estado = ?'; params.push(estado); }
  }
  if (tag) { sql += ' AND tags LIKE ?'; params.push(`%${tag}%`); }
  if (visited === 1 || visited === 0) { sql += ' AND visitada = ?'; params.push(visited); }
  return { sql, params };
}

const store = {
  kind: driver.kind,

  async list({ q, estado, tag, visited, orden } = {}) {
    let { sql, params } = where(q, estado, tag, visited);
    if (orden === 'precio') sql += " ORDER BY CAST(REPLACE(REPLACE(precio, '.', ''), '$', '') AS INTEGER) ASC";
    else sql += ' ORDER BY id DESC';
    const rows = await driver.all(sql, params);
    return rows.map(row => ({ ...row, foto_blob: undefined })); // no mandar el blob pesado en listados
  },

  async get(id) {
    const rows = await driver.all('SELECT * FROM propiedades WHERE id = ?', [id]);
    return rows[0] ? { ...rows[0], foto_blob: undefined } : null;
  },

  async upsert(b) {
    if (!b.url) throw new Error('falta url');
    const existing = await driver.all('SELECT id FROM propiedades WHERE url = ?', [b.url]);
    if (existing.length) {
      const id = existing[0].id;
      const cols = ALLOWED_FIELDS.filter(k => b[k] !== undefined && b[k] !== null);
      if (cols.length) {
        const sets = cols.map(k => `${k} = ?`).join(', ');
        await driver.run(`UPDATE propiedades SET ${sets}, fecha_actualizada = CURRENT_TIMESTAMP WHERE id = ?`, [...cols.map(k => b[k]), id]);
      }
      return { id, updated: true };
    }
    const fields = { estado: 'interes', visitada: 0, ...b };
    const keys = ['url', ...ALLOWED_FIELDS].filter(k => fields[k] !== undefined && fields[k] !== null);
    if (!keys.includes('url') || !fields.url) throw new Error('falta url');
    const info = await driver.run(
      `INSERT INTO propiedades (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
      keys.map(k => fields[k])
    );
    return { id: info.id };
  },

  async update(id, fields) {
    const keys = Object.keys(fields).filter(k => ALLOWED_FIELDS.includes(k));
    if (!keys.length) throw new Error('nada para actualizar');
    const sets = keys.map(k => `${k} = ?`).join(', ');
    await driver.run(
      `UPDATE propiedades SET ${sets}, fecha_actualizada = CURRENT_TIMESTAMP WHERE id = ?`,
      [...keys.map(k => fields[k]), id]
    );
    return store.get(id);
  },

  async remove(id) {
    await driver.run('DELETE FROM propiedades WHERE id = ?', [id]);
    return { ok: true };
  },

  async setFoto(id, base64, mime) {
    await driver.run(
      'UPDATE propiedades SET foto_blob = ?, foto_mime = ?, foto_url = ?, fecha_actualizada = CURRENT_TIMESTAMP WHERE id = ?',
      [base64, mime, `/api/propiedades/${id}/foto`, id]
    );
    return store.get(id);
  },

  async getFoto(id) {
    const rows = await driver.all('SELECT foto_blob, foto_mime FROM propiedades WHERE id = ?', [id]);
    return rows[0] || null;
  },
};

module.exports = { store, migrate };
