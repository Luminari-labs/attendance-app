#!/bin/bash
echo "Admin Reset Script - Attendance App"
echo "====================================="
echo ""

NODE_DIR="/app/backend"
DB_PATH="/app/data/attendance.db"

cd "$NODE_DIR" || exit 1

echo "Checking database..."
if [ ! -f "$DB_PATH" ]; then
    echo "ERROR: Database not found at $DB_PATH"
    exit 1
fi

echo "Checking for existing admin user..."
ADMIN_EXISTS=$(node -e "
const Database = require('better-sqlite3');
const db = new Database('$DB_PATH');
const row = db.prepare(\"SELECT email FROM users WHERE email='admin@luminari-labs.space'\").get();
console.log(row ? row.email : '');
db.close();
")

if [ -n "$ADMIN_EXISTS" ]; then
    echo "Admin user exists. Resetting password..."
    node -e "
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const db = new Database('$DB_PATH');

const hash = bcrypt.hashSync('admin123', 10);
const info = db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, 'admin@luminari-labs.space');
if (info.changes > 0) {
    console.log('Password reset successfully!');
} else {
    console.log('ERROR: User not found');
    process.exit(1);
}
db.close();
"
else
    echo "Admin user not found. Creating new admin..."
    node -e "
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const Database = require('better-sqlite3');
const db = new Database('$DB_PATH');

const id = randomUUID();
const email = 'admin@luminari-labs.space';
const name = 'Admin';
const role = 'admin';
const password = 'admin123';
const hash = bcrypt.hashSync(password, 10);

db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(id, name, email, hash, role);
console.log('Admin user created successfully!');
console.log('Credentials: admin@luminari-labs.space / admin123');
db.close();
"
fi

echo ""
echo "Done!"
