/**
 * users.js — Заглушка.
 * Вся работа с пользователями теперь идёт через реальный API сервера (/api/admin/users).
 * Демо-пользователи удалены, чтобы не мешать реальной базе данных.
 */
const USERS_DB = [];

function findUser(username) { return null; }
function getAllUsers() { return []; }
function validateCredentials(username, password) { return null; }