/**
 * users.js — Заглушка. 
 * Вся работа с пользователями теперь идёт через реальный API сервера (/api/admin/users).
 * Этот файл оставлен для совместимости, но база USERS_DB пуста.
 */
const USERS_DB = [];

function findUser(username) { return null; }
function getAllUsers() { return []; }
function validateCredentials(username, password) { return null; }