require('dotenv').config();
const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3001,
  JWT_SECRET: process.env.JWT_SECRET || 'supersecretjwtkey_replace_in_production',
  QR_SECRET: process.env.QR_SECRET || 'qr_secret_key_2026_attendance_app',
  QR_VALIDITY_MINUTES: parseInt(process.env.QR_VALIDITY_MINUTES) || 5,
  OFFICE_LAT: parseFloat(process.env.OFFICE_LAT) || 19.4326,
  OFFICE_LNG: parseFloat(process.env.OFFICE_LNG) || -99.1332,
  OFFICE_RADIUS_METERS: parseInt(process.env.OFFICE_RADIUS_METERS) || 100,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001',
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '../data/attendance.db')
};
