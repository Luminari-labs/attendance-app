const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { DB_PATH } = require('./config');

const dbPath = path.resolve(__dirname, DB_PATH);
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true, mode: 0o777 });
}

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

db.exec(`
  CREATE TABLE IF NOT EXISTS work_schedules (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    day_of_week INTEGER NOT NULL,
    start_time TEXT,
    end_time TEXT,
    is_workday INTEGER DEFAULT 1,
    UNIQUE(user_id, day_of_week),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS fines (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date, type)
  )
`);

const generalSchedulesCount = db.prepare("SELECT COUNT(*) as count FROM work_schedules WHERE user_id IS NULL").get().count;
if (generalSchedulesCount === 0) {
  const { randomUUID } = require('crypto');
  const insertStmt = db.prepare("INSERT INTO work_schedules (id, user_id, day_of_week, start_time, end_time, is_workday) VALUES (?, NULL, ?, NULL, NULL, ?)");
  for (let i = 0; i < 7; i++) {
    const isWorkday = (i >= 1 && i <= 5) ? 1 : 0;
    insertStmt.run(randomUUID(), i, isWorkday);
  }
  console.log('[DB] Default general work schedules seeded (Mon-Fri workdays)');
}

try {
  db.exec('ALTER TABLE attendance DROP COLUMN latitude');
} catch {
}

try {
  db.exec('ALTER TABLE attendance DROP COLUMN longitude');
} catch {
}

try {
  db.exec('ALTER TABLE qr_tokens DROP COLUMN office_id');
} catch {
}

const adminExists = db.prepare("SELECT id FROM users WHERE email = 'admin@luminari-labs.space'").get();
if (!adminExists) {
  const bcrypt = require('bcryptjs');
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(id, 'Admin', 'admin@luminari-labs.space', hash, 'admin');
  console.log('[DB] Admin user seeded (admin@luminari-labs.space / admin123)');
}

module.exports = db;
