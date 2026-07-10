const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const dbPath = process.argv[2] || '/app/data/attendance.db';
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'employee',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    qr_token TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS qr_tokens (
    token TEXT PRIMARY KEY,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

const users = [
  { name: 'Admin', email: 'admin@luminari-labs.space', password: 'admin123', role: 'admin' },
  { name: 'carlitos', email: 'fullstackdev@luminari-labs.space', password: 'Argon777.', role: 'employee' },
  { name: 'juanito', email: 'vibecoder@luminari-labs.space', password: '@Josejuan123', role: 'employee' },
  { name: 'cris', email: 'devops@luminari-labs.space', password: 'sDucker10', role: 'employee' },
  { name: 'mario', email: 'mariocoder@luminari-labs.space', password: 'MarioGamer64', role: 'employee' },
];

const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)');

for (const u of users) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
  if (existing) {
    console.log(`[SKIP] ${u.email} already exists`);
    continue;
  }
  const id = randomUUID();
  const hash = bcrypt.hashSync(u.password, 10);
  insertUser.run(id, u.name, u.email, hash, u.role);
  console.log(`[OK] ${u.name} <${u.email}> created (${u.role})`);
}

const count = db.prepare('SELECT COUNT(*) as c FROM users').get();
console.log(`\nTotal users: ${count.c}`);

db.close();
