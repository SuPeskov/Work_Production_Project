/**
 * users.js — База пользователей (прототип)
 * 
 * ВНИМАНИЕ: Это демонстрационная реализация.
 * В продакшене аутентификация должна быть на сервере,
 * а пароли — хешированы.
 */

const USERS_DB = [
    {
        username: 'admin',
        password: 'admin123',
        name: 'Администратор системы',
        role: 'Администратор',
        access: ['preparation', 'panels', 'module', 'options', 'installation', 'service']
    },
    {
        username: 'builder',
        password: 'build456',
        name: 'Иванов Сергей',
        role: 'Сотрудник производства',
        access: ['panels', 'installation']
    },
    {
        username: 'engineer',
        password: 'eng789',
        name: 'Петрова Анна',
        role: 'Сотрудник производства',
        access: ['preparation', 'panels', 'module']
    },
    {
        username: 'guest',
        password: 'guest123',
        name: 'Демонстрационный гость',
        role: 'Гость',
        access: ['preparation', 'panels', 'module', 'options', 'installation', 'service']
    }
];

/**
 * Найти пользователя по логину
 */
function findUser(username) {
    // Сначала локальная база (созданные администратором/изменённые), затем демо-база
    if (typeof kbGetUsers === 'function') {
        const local = kbGetUsers().find(u => u.username === username);
        if (local) return local;
    }
    return USERS_DB.find(u => u.username === username);
}

/** Все пользователи: демо-база + созданные администратором */
function getAllUsers() {
    if (typeof kbGetUsers === 'function') return kbGetUsers();
    return USERS_DB.slice();
}

/**
 * Проверить учётные данные
 */
function validateCredentials(username, password) {
    const user = findUser(username);
    if (user && user.password === password) {
        return user;
    }
    return null;
}