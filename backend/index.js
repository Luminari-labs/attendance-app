const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./database');
const config = require('./config');
const { generateQRToken, verifyQRToken } = require('./qr');

const app = express();
app.set('trust proxy', 1);
const now = () => new Date().toISOString();
const getClientIp = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
const isHttpsRequest = (req) => {
  const forwardedProto = req.headers['x-forwarded-proto']?.split(',')[0]?.trim();
  return req.secure || forwardedProto === 'https';
};
const maskEmail = (email = '') => {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email || 'unknown';
  if (name.length <= 2) return `${name[0] || '*'}*@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
};
const logInfo = (message, meta = {}) => console.log(`[${now()}] [INFO] ${message}`, meta);
const logWarn = (message, meta = {}) => console.warn(`[${now()}] [WARN] ${message}`, meta);
const logError = (message, meta = {}) => console.error(`[${now()}] [ERROR] ${message}`, meta);

app.use((req, res, next) => {
  const shouldEnforceHttps =
    process.env.NODE_ENV === 'production' &&
    process.env.ENFORCE_HTTPS !== 'false';

  if (shouldEnforceHttps && !isHttpsRequest(req)) {
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  }

  if (isHttpsRequest(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return next();
});

const corsOptions = {
  origin: config.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logInfo('HTTP request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      ip: getClientIp(req)
    });
  });
  next();
});

const frontendBuildPath = process.env.FRONTEND_BUILD_PATH || path.join(__dirname, '../frontend/build');
app.use(express.static(frontendBuildPath));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    logWarn('Auth rejected: missing token', { path: req.originalUrl, ip: getClientIp(req) });
    return res.sendStatus(401);
  }
  jwt.verify(token, config.JWT_SECRET, (err, user) => {
    if (err) {
      logWarn('Auth rejected: invalid token', { path: req.originalUrl, ip: getClientIp(req), error: err.message });
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (password) => password && password.length >= 6;

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (!validatePassword(password)) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const password_hash = await bcrypt.hash(password, 10);
  const id = randomUUID();
  try {
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(id, name, email, password_hash, role || 'employee');
    const token = jwt.sign({ id, email, role: role || 'employee' }, config.JWT_SECRET);
    logInfo('Register success', { email: maskEmail(email), role: role || 'employee', ip: getClientIp(req) });
    res.json({ token, user: { id, name, email, role: role || 'employee' } });
  } catch (err) {
    logWarn('Register failed', { email: maskEmail(email), ip: getClientIp(req), error: err.message });
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (!password) return res.status(400).json({ error: 'Password required' });
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      logWarn('Login failed: user not found', { email: maskEmail(email), ip: getClientIp(req) });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logWarn('Login failed: invalid password', { email: maskEmail(email), ip: getClientIp(req) });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.JWT_SECRET);
    logInfo('Login success', { userId: user.id, email: maskEmail(user.email), role: user.role, ip: getClientIp(req) });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    logError('Login DB error', { email: maskEmail(email), ip: getClientIp(req), error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/qr/current', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const token = generateQRToken();
  const expiresAt = new Date(Date.now() + config.QR_VALIDITY_MINUTES * 60000).toISOString();
  try {
    db.prepare('INSERT OR REPLACE INTO qr_tokens (token, expires_at) VALUES (?, ?)').run(token, expiresAt);
    res.json({ token, expires_at: expiresAt });
  } catch (err) {
    logError('QR generation DB error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

const markAttendance = db.transaction((userId, qrToken, type) => {
  const qrRow = db.prepare('SELECT * FROM qr_tokens WHERE token = ? AND used = 0 AND expires_at > ?').get(qrToken, new Date().toISOString());
  if (!qrRow) return { error: 'Invalid or expired QR' };
  db.prepare('UPDATE qr_tokens SET used = 1 WHERE token = ?').run(qrToken);
  const attendanceId = randomUUID();
  db.prepare('INSERT INTO attendance (id, user_id, type, qr_token) VALUES (?, ?, ?, ?)').run(attendanceId, userId, type, qrToken);
  return { success: true, attendance_id: attendanceId, type, timestamp: new Date().toISOString() };
});

app.post('/api/attendance/mark', authenticateToken, (req, res) => {
  const { qr_token, type } = req.body;
  if (!qr_token || !type) return res.status(400).json({ error: 'Missing fields' });
  if (!['entry', 'exit'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  try {
    const decoded = verifyQRToken(qr_token);
  } catch {
    logWarn('Attendance failed: invalid/expired QR', { userId: req.user.id, ip: getClientIp(req) });
    return res.status(400).json({ error: 'Invalid or expired QR' });
  }
  const result = markAttendance(req.user.id, qr_token, type);
  if (result.error) {
    logWarn('Attendance failed: ' + result.error, { userId: req.user.id, ip: getClientIp(req) });
    return res.status(400).json({ error: result.error });
  }
  logInfo('Attendance marked', { attendanceId: result.attendance_id, userId: req.user.id, type });
  res.json(result);
});

app.get('/api/attendance/my-history', authenticateToken, (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  try {
    const rows = db.prepare('SELECT * FROM attendance WHERE user_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(req.user.id, limit, offset);
    res.json(rows);
  } catch (err) {
    logError('My history query error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/admin/attendance', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const offset = parseInt(req.query.offset) || 0;
  const limit = Math.min(parseInt(req.query.limit) || 200, 500);
  try {
    const rows = db.prepare('SELECT a.*, u.name, u.email FROM attendance a JOIN users u ON a.user_id = u.id ORDER BY a.timestamp DESC LIMIT ? OFFSET ?').all(limit, offset);
    res.json(rows);
  } catch (err) {
    logError('Admin attendance query error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/admin/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const rows = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
    res.json(rows);
  } catch (err) {
    logError('Admin users query error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

app.use((err, req, res, next) => {
  logError('Unhandled API error', {
    path: req.originalUrl,
    method: req.method,
    ip: getClientIp(req),
    error: err?.message || err
  });
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

if (require.main === module) {
  app.listen(config.PORT, () => logInfo(`Server running on port ${config.PORT}`));
}

process.on('unhandledRejection', (reason) => {
  logError('Unhandled promise rejection', { reason: reason?.stack || reason });
});

process.on('uncaughtException', (error) => {
  logError('Uncaught exception', { error: error?.stack || error });
});

module.exports = app;
