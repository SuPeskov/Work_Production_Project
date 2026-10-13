/**
 * init-db.js — первичная инициализация БД: администратор + демо-пользователи.
 * Запуск: KB_ADMIN_PASS='...' node init-db.js   (пароль админа — только из env!)
 */
const bcrypt = require('bcryptjs');
const { db } = require('./db');

const adminPass = process.env.KB_ADMIN_PASS;
if (!adminPass || adminPass.length < 8) {
  console.error('Задайте KB_ADMIN_PASS (минимум 8 символов). Пример: KB_ADMIN_PASS="S1lv3r$ky2026" node init-db.js');
  process.exit(1);
}

const upsertUser = db.prepare(`
  INSERT INTO users (username, name, role, pass_hash) VALUES (?, ?, ?, ?)
  ON CONFLICT(username) DO UPDATE SET name=excluded.name, role=excluded.role
`);
const hash = (p) => bcrypt.hashSync(p, 10);

upsertUser.run('admin', 'Администратор БЗ', 'admin', hash(adminPass));
console.log('Создан/обновлён администратор: admin (пароль из KB_ADMIN_PASS)');

if (process.env.KB_DEMO === '1') {
  upsertUser.run('builder', 'Иванов Иван Иванович', 'worker', hash('build456'));
  upsertUser.run('guest1', 'Гость демонстрационный', 'guest', hash('guest123'));
  const uid = db.prepare('SELECT id FROM users WHERE username=?').get('builder').id;
  ['panels', 'assembly'].forEach(s =>
    db.prepare('INSERT OR IGNORE INTO user_sections (user_id, section_id) VALUES (?,?)').run(uid, s));
  console.log('DEMO-аккаунты созданы (builder/build456, guest1/guest123). НЕ используйте на боевом сервере!');
}
console.log('Готово. БД:', db.name);
