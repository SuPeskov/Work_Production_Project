/**
 * db.js — SQLite-схема базы знаний Скаут Хаус
 *
 * Таблицы:
 *  users      — учётные записи (пароли только bcrypt-хешами)
 *  sections   — справочник разделов базы знаний
 *  user_sections — доступ пользователя к разделам (роль Гость/Сотрудник)
 *  read_log   — неизменяемый журнал ознакомлений (юридически значимые метки)
 */
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.KB_DB_PATH || path.join(__dirname, 'kb.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','worker','guest')),
  pass_hash   TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,   -- 0 = удалён администратором
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS sections (
  id   TEXT PRIMARY KEY,     -- 'preparation','panels','module','options','assembly','safety'
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sections (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id TEXT    NOT NULL REFERENCES sections(id),
  PRIMARY KEY (user_id, section_id)
);

-- Неизменяемый журнал: отметку можно только добавить, не изменить и не удалить.
-- При удалении пользователя запись ОСТАЁТСЯ (история для мониторинга).
CREATE TABLE IF NOT EXISTS read_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  username   TEXT NOT NULL,             -- денормализация: имя на момент отметки
  full_name  TEXT NOT NULL,
  role       TEXT NOT NULL,
  op_id      TEXT NOT NULL,
  op_title   TEXT NOT NULL,
  section_id TEXT NOT NULL,
  version    TEXT NOT NULL,
  read_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_read_user ON read_log(user_id);
CREATE INDEX IF NOT EXISTS idx_read_op   ON read_log(op_id, version);
`);

// Справочник разделов (идемпотентно)
const upsertSection = db.prepare(
  'INSERT INTO sections (id, title) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title'
);
[
  ['preparation', 'Заготовка'],
  ['panels',      'Сборка панелей'],
  ['module',      'Сборка модуля'],
  ['options',     'Опции и доработки'],
  ['assembly',    'Монтаж на объекте'],
  ['safety',      'Охрана труда и безопасность'],
].forEach(([id, title]) => upsertSection.run(id, title));

module.exports = { db, DB_PATH };
