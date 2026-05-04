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
ADMIN_EXISTS=$(sqlite3 "$DB_PATH" "SELECT email FROM users WHERE email='admin@company.com';" 2>/dev/null)

if [ -n "$ADMIN_EXISTS" ]; then
    echo "Admin user exists. Resetting password..."
    node -e "
const bcrypt = require('bcryptjs');
const db = require('./database');
const { randomUUID } = require('crypto');

bcrypt.hash('admin123', 10).then(hash => {
    db.run('UPDATE users SET password_hash = ? WHERE email = ?', [hash, 'admin@company.com'], (err) => {
        if (err) {
            console.log('ERROR:', err.message);
            process.exit(1);
        }
        console.log('Password reset successfully!');
        process.exit(0);
    });
});
"
else
    echo "Admin user not found. Creating new admin..."
    node -e "
const bcrypt = require('bcryptjs');
const db = require('./database');
const { randomUUID } = require('crypto');
const config = require('./config');

const id = randomUUID();
const email = 'admin@company.com';
const name = 'Admin';
const role = 'admin';
const password = 'admin123';

bcrypt.hash(password, 10).then(hash => {
    db.run('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', 
        [id, name, email, hash, role], (err) => {
        if (err) {
            console.log('ERROR:', err.message);
            process.exit(1);
        }
        console.log('Admin user created successfully!');
        console.log('Credentials: admin@company.com / admin123');
        process.exit(0);
    });
});
"
fi

echo ""
echo "Done!"
