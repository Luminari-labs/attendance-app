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
const { checkGeofence } = require('./geofence');

const app = express();
app.set('trust proxy', 1);
const now = () => new Date().toISOString();
const getClientIp = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
const maskEmail = (email = '') => {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email || 'unknown';
  if (name.length <= 2) return `${name[0] || '*'}*@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
};
const logInfo = (message, meta = {}) => console.log(`[${now()}] [INFO] ${message}`, meta);
const logWarn = (message, meta = {}) => console.warn(`[${now()}] [WARN] ${message}`, meta);
const logError = (message, meta = {}) => console.error(`[${now()}] [ERROR] ${message}`, meta);

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

// Serve frontend static files
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
  db.run(
    'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [id, name, email, password_hash, role || 'employee'],
    (err) => {
      if (err) {
        logWarn('Register failed', { email: maskEmail(email), ip: getClientIp(req), error: err.message });
        return res.status(400).json({ error: 'Email already exists' });
      }
      const token = jwt.sign({ id, email, role: role || 'employee' }, config.JWT_SECRET);
      logInfo('Register success', { email: maskEmail(email), role: role || 'employee', ip: getClientIp(req) });
      res.json({ token, user: { id, name, email, role: role || 'employee' } });
    }
  );
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (!password) return res.status(400).json({ error: 'Password required' });
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      logError('Login DB error', { email: maskEmail(email), ip: getClientIp(req), error: err.message });
      return res.status(500).json({ error: 'DB error' });
    }
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
  });
});

app.get('/api/qr/current', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const token = generateQRToken();
  const expiresAt = new Date(Date.now() + config.QR_VALIDITY_MINUTES * 60000).toISOString();
  db.run('INSERT OR REPLACE INTO qr_tokens (token, expires_at) VALUES (?, ?)', [token, expiresAt], (err) => {
    if (err) {
      logError('QR generation DB error', { userId: req.user.id, error: err.message });
      return res.status(500).json({ error: 'DB error' });
    }
    res.json({ token, expires_at: expiresAt });
  });
});

app.post('/api/attendance/mark', authenticateToken, (req, res) => {
  const { qr_token, latitude, longitude, type } = req.body;
  if (!qr_token || latitude === undefined || longitude === undefined || !type) return res.status(400).json({ error: 'Missing fields' });
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return res.status(400).json({ error: 'Invalid coordinates' });
  if (!['entry', 'exit'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  verifyQRToken(qr_token, (err, decoded) => {
    if (err) {
      logWarn('Attendance failed: invalid/expired QR', { userId: req.user.id, ip: getClientIp(req) });
      return res.status(400).json({ error: 'Invalid or expired QR' });
    }
    db.get('SELECT * FROM qr_tokens WHERE token = ? AND used = 0 AND expires_at > ?', [qr_token, new Date().toISOString()], (err, qrRow) => {
      if (err) {
        logError('Attendance failed: DB read QR error', { userId: req.user.id, error: err.message });
        return res.status(500).json({ error: 'DB error' });
      }
      if (!qrRow) return res.status(400).json({ error: 'QR already used or expired' });
      if (!checkGeofence(latitude, longitude)) {
        logWarn('Attendance rejected: outside geofence', { userId: req.user.id, latitude, longitude, ip: getClientIp(req) });
        return res.status(400).json({ error: 'Outside office radius' });
      }
      db.run('UPDATE qr_tokens SET used = 1 WHERE token = ?', [qr_token], (err) => {
        if (err) {
          logError('Attendance failed: DB update QR error', { userId: req.user.id, error: err.message });
          return res.status(500).json({ error: 'DB error' });
        }
        const attendanceId = randomUUID();
        db.run(
          'INSERT INTO attendance (id, user_id, type, latitude, longitude, qr_token) VALUES (?, ?, ?, ?, ?, ?)',
          [attendanceId, req.user.id, type, latitude, longitude, qr_token],
          (err) => {
            if (err) {
              logError('Attendance failed: DB insert error', { userId: req.user.id, error: err.message });
              return res.status(500).json({ error: 'DB error' });
            }
            logInfo('Attendance marked', { attendanceId, userId: req.user.id, type, latitude, longitude });
            res.json({ success: true, attendance_id: attendanceId, type, timestamp: new Date().toISOString() });
          }
        );
      });
    });
  });
});

app.get('/api/attendance/my-history', authenticateToken, (req, res) => {
  db.all('SELECT * FROM attendance WHERE user_id = ? ORDER BY timestamp DESC LIMIT 100', [req.user.id], (err, rows) => {
    if (err) {
      logError('My history query error', { userId: req.user.id, error: err.message });
      return res.status(500).json({ error: 'DB error' });
    }
    res.json(rows);
  });
});

app.get('/api/admin/attendance', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  db.all(`SELECT a.*, u.name, u.email FROM attendance a JOIN users u ON a.user_id = u.id ORDER BY a.timestamp DESC LIMIT 200`, [], (err, rows) => {
    if (err) {
      logError('Admin attendance query error', { userId: req.user.id, error: err.message });
      return res.status(500).json({ error: 'DB error' });
    }
    res.json(rows);
  });
});

app.get('/api/admin/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  db.all('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      logError('Admin users query error', { userId: req.user.id, error: err.message });
      return res.status(500).json({ error: 'DB error' });
    }
    res.json(rows);
  });
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

// Serve React SPA for all non-API routes
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
