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
        name: 'Администратор',
        role: 'Администратор',
        access: ['production', 'assembly', 'installation', 'engineering', 'finishing', 'maintenance']
    },
    {
        username: 'builder',
        password: 'build456',
        name: 'Иванов Сергей',
        role: 'Монтажник',
        access: ['assembly', 'installation']
    },
    {
        username: 'engineer',
        password: 'eng789',
        name: 'Петрова Анна',
        role: 'Инженер',
        access: ['production', 'engineering', 'finishing']
    }
];

/**
 * Найти пользователя по логину
 */
function findUser(username) {
    return USERS_DB.find(u => u.username === username);
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