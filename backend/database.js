const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { DB_PATH } = require('./config');

const db = new sqlite3.Database(path.resolve(__dirname, DB_PATH), (err) => {
  if (err) console.error('DB Error:', err);
  else console.log('Connected to SQLite');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'employee',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    latitude REAL,
    longitude REAL,
    qr_token TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS qr_tokens (
    token TEXT PRIMARY KEY,
    office_id TEXT DEFAULT 'main',
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  db.get("SELECT * FROM settings WHERE key='office_lat'", [], (err, row) => {
    if (!row) {
      db.run("INSERT INTO settings (key, value) VALUES ('office_lat', '19.4326')");
      db.run("INSERT INTO settings (key, value) VALUES ('office_lng', '-99.1332')");
      db.run("INSERT INTO settings (key, value) VALUES ('office_radius', '100')");
      db.run("INSERT INTO settings (key, value) VALUES ('qr_interval', '5')");
    }
  });
});

module.exports = db;
