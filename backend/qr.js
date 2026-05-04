const jwt = require('jsonwebtoken');
const config = require('./config');

const generateQRToken = () => {
  const payload = {
    type: 'attendance_qr',
    generated_at: Date.now(),
    expires_in: config.QR_VALIDITY_MINUTES * 60000
  };
  return jwt.sign(payload, config.QR_SECRET, { expiresIn: `${config.QR_VALIDITY_MINUTES}m` });
};

const verifyQRToken = (token, callback) => {
  jwt.verify(token, config.QR_SECRET, callback);
};

module.exports = { generateQRToken, verifyQRToken };
