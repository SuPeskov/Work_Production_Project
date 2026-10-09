/**
 * app.js — Backend базы знаний Скаут Хаус (PPR)
 *
 * Защищённый верифицированный вход (bcrypt + JWT в httpOnly-cookie),
 * серверная проверка прав доступа к разделам, неизменяемый журнал
 * ознакомлений. Статика сайта раздаётся из ../public.
 *
 * Запуск:  KB_JWT_SECRET=... node app.js   (порт 3000)
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { db } = require('./db');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.KB_JWT_SECRET;
if (!JWT_SECRET) { console.error('ОБЯЗАТЕЛЬНО задайте переменную окружения KB_JWT_SECRET'); process.exit(1); }

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ROLE_LABELS = { admin: 'Администратор', worker: 'Сотрудник производства', guest: 'Гость' };

// Реестр операций берём из единого источника kb.js, чтобы клиент и сервер
// не разъезжались: вырезаем литералы KB_SECTIONS / KB_OPERATIONS и безопасно
// разворачиваем их через Function-обёртку (без доступа к переменным модуля).
function extractLiteral(src, name) {
  const start = src.indexOf(`const ${name} = [`);
  if (start === -1) return [];
  const from = src.indexOf('[', start);
  let depth = 0, end = -1;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return [];
  try { return Function(`"use strict"; return (${src.slice(from, end + 1)});`)(); }
  catch (e) { console.warn(`Не удалось разобрать ${name}:`, e.message); return []; }
}
let OPERATIONS = [], SECTIONS = [];
try {
  const src = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'kb.js'), 'utf8');
  OPERATIONS = extractLiteral(src, 'KB_OPERATIONS');
  SECTIONS = extractLiteral(src, 'KB_SECTIONS').map(s => s.id);
} catch (e) { console.warn('Не удалось загрузить реестр операций:', e.message); }
if (!OPERATIONS.length) console.warn('ВНИМАНИЕ: реестр операций пуст — проверьте public/js/kb.js');
const OP_MAP = Object.fromEntries(OPERATIONS.map(o => [o.id, o]));

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser());

// === Middleware: аутентификация и права ===
function auth(required = true, roles = null) {
  return (req, res, next) => {
    const token = req.cookies.kb_token;
    let user = null;
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        user = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(payload.uid);
      } catch (_) { /* токен невалиден */ }
    }
    if (!user && required) return res.status(401).json({ error: 'Требуется вход' });
    if (user && roles && !roles.includes(user.role)) return res.status(403).json({ error: 'Нет прав' });
    req.user = user;
    next();
  };
}
function sectionsOf(userId) {
  return db.prepare('SELECT section_id FROM user_sections WHERE user_id=?').all(userId).map(r => r.section_id);
}
function canAccess(user, sectionId) {
  if (!user) return false;
  if (user.role === 'admin') return true;              // админ — без ограничений
  if (user.role === 'guest') return true;              // гость видит всё (по ТЗ)
  return sectionsOf(user.id).includes(sectionId);      // сотрудник — только назначенное
}

// === Auth API ===
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true });

app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Укажите логин и пароль' });
  const user = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(String(username).trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(password), user.pass_hash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '12h' });
  res.cookie('kb_token', token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.KB_SECURE_COOKIE === '1', maxAge: 12 * 3600 * 1000,
  });
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/logout', (req, res) => { res.clearCookie('kb_token'); res.json({ ok: true }); });

app.get('/api/me', auth(false), (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: publicUser(req.user), sections: req.user.role === 'worker' ? sectionsOf(req.user.id) : '*' });
});

function publicUser(u) {
  return { username: u.username, name: u.name, role: u.role, roleLabel: ROLE_LABELS[u.role] };
}

// === Права на чтение контента (серверный enforce) ===
app.get('/api/access/:sectionId', auth(), (req, res) => {
  res.json({ allowed: canAccess(req.user, req.params.sectionId) });
});

// Защита страниц по ролям: запрещённые разделы отдают 403 вместо HTML
const SECTION_BY_PATH = { preparation: 'preparation', panels: 'panels', module: 'module', options: 'options', assembly: 'assembly', safety: 'safety' };
app.use((req, res, next) => {
  const m = req.path.match(/^\/pages\/(?:operations|sections)?\/?([\w.-]+)\.html$/i);
  // страницы операций вида /pages/operations/2.1.5.html → раздел по префиксу id
  let sectionId = null;
  const opMatch = req.path.match(/(\d+\.\d+\.\d+)\.html$/);
  if (opMatch && OP_MAP[opMatch[1]]) sectionId = OP_MAP[opMatch[1]].section;
  else for (const key of Object.keys(SECTION_BY_PATH)) if (req.path.includes(key + '.html')) sectionId = key;
  if (!sectionId) return next();
  // проверяем токен без обязательности входа
  auth(false)(req, res, () => {
    if (!req.user) return res.redirect('/index.html?need_login=1');
    if (!canAccess(req.user, sectionId)) return res.status(403).sendFile(path.join(PUBLIC_DIR, 'no-access.html'));
    next();
  });
});

// === Журнал ознакомлений (только сервер пишет!) ===
app.post('/api/read/:opId', auth(true, ['worker']), (req, res) => {
  const op = OP_MAP[req.params.opId];
  if (!op) return res.status(404).json({ error: 'Неизвестная операция' });
  if (!canAccess(req.user, op.section)) return res.status(403).json({ error: 'Нет доступа к разделу' });
  const version = String(req.body?.version || op.version || 'v1');
  // идемпотентность: одна отметка на связку пользователь+операция+версия
  const exists = db.prepare('SELECT id FROM read_log WHERE user_id=? AND op_id=? AND version=?')
    .get(req.user.id, op.id, version);
  if (!exists) {
    db.prepare(`INSERT INTO read_log (user_id, username, full_name, role, op_id, op_title, section_id, version)
                VALUES (?,?,?,?,?,?,?,?)`)
      .run(req.user.id, req.user.username, req.user.name, req.user.role, op.id, op.title, op.section, version);
  }
  res.json({ ok: true, already: !!exists });
});

app.get('/api/reads', auth(), (req, res) => {
  // Гость и админ видят весь журнал; сотрудник — только свои отметки
  const rows = req.user.role === 'worker'
    ? db.prepare('SELECT * FROM read_log WHERE user_id=? ORDER BY read_at DESC').all(req.user.id)
    : db.prepare('SELECT * FROM read_log ORDER BY read_at DESC').all();
  res.json(rows);
});

// === Админ API (CRUD пользователей) ===
const ROLES = ['admin', 'worker', 'guest'];
app.get('/api/admin/users', auth(true, ['admin']), (req, res) => {
  const users = db.prepare("SELECT id, username, name, role, active FROM users WHERE active=1 ORDER BY username").all();
  users.forEach(u => u.sections = sectionsOf(u.id));
  res.json(users);
});

app.post('/api/admin/users', auth(true, ['admin']), (req, res) => {
  const { username, name, role, password, sections } = req.body || {};
  if (!username || !name || !ROLES.includes(role) || !password || String(password).length < 6) {
    return res.status(400).json({ error: 'Логин, ФИО, роль и пароль (мин. 6 символов) обязательны' });
  }
  const uname = String(username).trim().toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE username=?').get(uname)) {
    return res.status(409).json({ error: 'Такой логин уже занят' });
  }
  const info = db.prepare('INSERT INTO users (username, name, role, pass_hash) VALUES (?,?,?,?)')
    .run(uname, String(name).trim(), role, bcrypt.hashSync(String(password), 10));
  setSections(info.lastInsertRowid, sections);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.post('/api/admin/users/:id/password', auth(true, ['admin']), (req, res) => {
  const { password } = req.body || {};
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  const u = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(bcrypt.hashSync(String(password), 10), u.id);
  res.json({ ok: true });
});

app.post('/api/admin/users/:id/access', auth(true, ['admin']), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  setSections(u.id, req.body?.sections || []);
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', auth(true, ['admin']), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  if (u.role === 'admin' && db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin' AND active=1").get().c <= 1) {
    return res.status(400).json({ error: 'Нельзя удалить последнего администратора' });
  }
  // soft-delete: journal остаётся (read_log NOT NULL FK — запись физически не удалится)
  db.prepare("UPDATE users SET active=0, deleted_at=datetime('now') WHERE id=?").run(u.id);
  db.prepare('DELETE FROM user_sections WHERE user_id=?').run(u.id);
  res.json({ ok: true });
});

function setSections(userId, list) {
  db.prepare('DELETE FROM user_sections WHERE user_id=?').run(userId);
  const ins = db.prepare('INSERT OR IGNORE INTO user_sections (user_id, section_id) VALUES (?,?)');
  (Array.isArray(list) ? list : []).forEach(s => {
    if (db.prepare('SELECT id FROM sections WHERE id=?').get(s)) ins.run(userId, s);
  });
}

// === Статика (после API-маршрутов) ===
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.listen(PORT, '127.0.0.1', () => console.log(`KB server: http://127.0.0.1:${PORT}`));
