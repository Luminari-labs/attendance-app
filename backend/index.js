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

app.post('/api/auth/register', authLimiter, (req, res) => {
  logWarn('Public registration attempt blocked', { ip: getClientIp(req) });
  res.status(403).json({ error: 'Registration is disabled. Please contact the administrator.' });
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

const toISO = (ts) => {
  if (!ts) return ts;
  if (ts.endsWith('Z')) return ts;
  if (ts.includes('T')) return ts + 'Z';
  return ts.replace(' ', 'T') + 'Z';
};

const getLocalDateString = (dateObj) => {
  // America/Guayaquil is UTC-5 permanently
  const localDate = new Date(dateObj.getTime() - 5 * 60 * 60 * 1000);
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalTimeString = (dateObj) => {
  // America/Guayaquil is UTC-5 permanently
  const localDate = new Date(dateObj.getTime() - 5 * 60 * 60 * 1000);
  const hour = String(localDate.getUTCHours()).padStart(2, '0');
  const minute = String(localDate.getUTCMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
};

const getDatesRange = (startDateStr, endDateStr) => {
  const dates = [];
  let curr = new Date(startDateStr + 'T12:00:00Z');
  const end = new Date(endDateStr + 'T12:00:00Z');
  while (curr <= end) {
    const y = curr.getUTCFullYear();
    const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const d = String(curr.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
};

const syncFinesForUser = (userId) => {
  const user = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId);
  if (!user) return;
  
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterday);
  const createdDateStr = getLocalDateString(new Date(toISO(user.created_at)));
  
  if (createdDateStr > yesterdayStr) return;
  
  const datesToCheck = getDatesRange(createdDateStr, yesterdayStr);
  const attendanceRows = db.prepare('SELECT * FROM attendance WHERE user_id = ?').all(userId);
  
  const attendanceByDate = {};
  for (const row of attendanceRows) {
    const localDate = getLocalDateString(new Date(toISO(row.timestamp)));
    if (!attendanceByDate[localDate]) attendanceByDate[localDate] = [];
    attendanceByDate[localDate].push(row);
  }
  
  for (const dateStr of datesToCheck) {
    const dateObj = new Date(dateStr + 'T12:00:00Z');
    const dayOfWeek = dateObj.getUTCDay();
    
    let schedule = db.prepare('SELECT * FROM work_schedules WHERE user_id = ? AND day_of_week = ?').get(userId, dayOfWeek);
    if (!schedule) {
      schedule = db.prepare('SELECT * FROM work_schedules WHERE user_id IS NULL AND day_of_week = ?').get(dayOfWeek);
    }
    
    if (!schedule || schedule.is_workday === 0) continue;
    
    const dayRecords = attendanceByDate[dateStr] || [];
    const entries = dayRecords.filter(r => r.type === 'entry').sort((a, b) => new Date(toISO(a.timestamp)) - new Date(toISO(b.timestamp)));
    const exits = dayRecords.filter(r => r.type === 'exit').sort((a, b) => new Date(toISO(a.timestamp)) - new Date(toISO(b.timestamp)));
    
    if (entries.length === 0) {
      db.prepare('INSERT OR IGNORE INTO fines (id, user_id, date, type, details) VALUES (?, ?, ?, ?, ?)')
        .run(randomUUID(), userId, dateStr, 'missing_entry', `Falta de registro de entrada el ${dateStr}`);
    } else if (schedule.start_time) {
      const earliestEntry = entries[0];
      const entryTimeStr = getLocalTimeString(new Date(toISO(earliestEntry.timestamp)));
      if (entryTimeStr > schedule.start_time) {
        db.prepare('INSERT OR IGNORE INTO fines (id, user_id, date, type, details) VALUES (?, ?, ?, ?, ?)')
          .run(randomUUID(), userId, dateStr, 'late_entry', `Entrada tarde el ${dateStr}: registrada a las ${entryTimeStr}, requerida: ${schedule.start_time}`);
      }
    }
    
    if (exits.length === 0) {
      db.prepare('INSERT OR IGNORE INTO fines (id, user_id, date, type, details) VALUES (?, ?, ?, ?, ?)')
        .run(randomUUID(), userId, dateStr, 'missing_exit', `Falta de registro de salida el ${dateStr}`);
    } else if (schedule.end_time) {
      const latestExit = exits[exits.length - 1];
      const exitTimeStr = getLocalTimeString(new Date(toISO(latestExit.timestamp)));
      if (exitTimeStr < schedule.end_time) {
        db.prepare('INSERT OR IGNORE INTO fines (id, user_id, date, type, details) VALUES (?, ?, ?, ?, ?)')
          .run(randomUUID(), userId, dateStr, 'early_exit', `Salida antes de tiempo el ${dateStr}: registrada a las ${exitTimeStr}, requerida: ${schedule.end_time}`);
      }
    }
  }
};

app.get('/api/attendance/my-history', authenticateToken, (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  try {
    const rows = db.prepare('SELECT * FROM attendance WHERE user_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(req.user.id, limit, offset);
    res.json(rows.map(r => ({ ...r, timestamp: toISO(r.timestamp) })));
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
    res.json(rows.map(r => ({ ...r, timestamp: toISO(r.timestamp) })));
  } catch (err) {
    logError('Admin attendance query error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/admin/attendance/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM attendance WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Attendance not found' });
    logInfo('Attendance deleted', { attendanceId: id, userId: req.user.id });
    res.json({ success: true });
  } catch (err) {
    logError('Delete attendance error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/admin/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const rows = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
    res.json(rows.map(r => ({ ...r, created_at: toISO(r.created_at) })));
  } catch (err) {
    logError('Admin users query error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (!validatePassword(password)) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const password_hash = await bcrypt.hash(password, 10);
  const id = randomUUID();
  try {
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(id, name, email, password_hash, role || 'employee');
    logInfo('User created by admin', { creator: req.user.email, email: maskEmail(email), role: role || 'employee', ip: getClientIp(req) });
    res.json({ success: true, user: { id, name, email, role: role || 'employee' } });
  } catch (err) {
    logWarn('User creation by admin failed', { email: maskEmail(email), ip: getClientIp(req), error: err.message });
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.get('/api/admin/schedules', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const rows = db.prepare('SELECT * FROM work_schedules').all();
    res.json(rows);
  } catch (err) {
    logError('Get schedules error', { error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/admin/schedules', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { user_id, schedules } = req.body;
  if (!Array.isArray(schedules)) return res.status(400).json({ error: 'Schedules must be an array' });
  
  const checkGeneralExists = db.prepare('SELECT id FROM work_schedules WHERE user_id IS NULL AND day_of_week = ?');
  const updateGeneralStmt = db.prepare('UPDATE work_schedules SET start_time = ?, end_time = ?, is_workday = ? WHERE user_id IS NULL AND day_of_week = ?');
  const insertGeneralStmt = db.prepare('INSERT INTO work_schedules (id, user_id, day_of_week, start_time, end_time, is_workday) VALUES (?, NULL, ?, ?, ?, ?)');

  const upsertUserStmt = db.prepare(`
    INSERT INTO work_schedules (id, user_id, day_of_week, start_time, end_time, is_workday)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, day_of_week) DO UPDATE SET
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      is_workday = excluded.is_workday
  `);

  try {
    const runTransaction = db.transaction(() => {
      for (const s of schedules) {
        if (user_id === null || user_id === undefined) {
          const row = checkGeneralExists.get(s.day_of_week);
          if (row) {
            updateGeneralStmt.run(s.start_time || null, s.end_time || null, s.is_workday, s.day_of_week);
          } else {
            insertGeneralStmt.run(randomUUID(), s.day_of_week, s.start_time || null, s.end_time || null, s.is_workday);
          }
        } else {
          upsertUserStmt.run(randomUUID(), user_id, s.day_of_week, s.start_time || null, s.end_time || null, s.is_workday);
        }
      }
    });
    runTransaction();
    logInfo('Schedules updated', { admin: req.user.email, for_user: user_id || 'general' });
    res.json({ success: true });
  } catch (err) {
    logError('Save schedules error', { error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/admin/schedules/user/:user_id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { user_id } = req.params;
  try {
    db.prepare('DELETE FROM work_schedules WHERE user_id = ?').run(user_id);
    logInfo('Custom schedules deleted (restored to general)', { admin: req.user.email, user_id });
    res.json({ success: true });
  } catch (err) {
    logError('Delete custom schedules error', { error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/admin/fines', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const users = db.prepare('SELECT id FROM users').all();
    for (const user of users) {
      syncFinesForUser(user.id);
    }
    const rows = db.prepare(`
      SELECT f.*, u.name, u.email 
      FROM fines f 
      JOIN users u ON f.user_id = u.id 
      WHERE f.is_excused = 0
      ORDER BY f.date DESC, f.created_at DESC
    `).all();
    res.json(rows);
  } catch (err) {
    logError('Admin query fines error', { error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/admin/fines/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { id } = req.params;
  try {
    const result = db.prepare('UPDATE fines SET is_excused = 1 WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Fine not found' });
    logInfo('Fine excused by admin', { fineId: id, admin: req.user.email });
    res.json({ success: true });
  } catch (err) {
    logError('Excuse fine error', { error: err.message });
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/attendance/my-fines', authenticateToken, (req, res) => {
  try {
    syncFinesForUser(req.user.id);
    const rows = db.prepare('SELECT * FROM fines WHERE user_id = ? AND is_excused = 0 ORDER BY date DESC').all(req.user.id);
    res.json(rows);
  } catch (err) {
    logError('My fines query error', { userId: req.user.id, error: err.message });
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
