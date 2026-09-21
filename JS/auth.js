/**
 * auth.js — Логика авторизации и управления сессией
 */

const SESSION_KEY = 'modular_house_session';

/**
 * Сохранить сессию
 */
function setSession(user) {
    const session = {
        username: user.username,
        name: user.name,
        role: user.role,
        access: user.access,
        loginTime: new Date().toISOString()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Получить текущего пользователя из сессии
 */
function getCurrentUser() {
    const data = sessionStorage.getItem(SESSION_KEY);
    if (data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            return null;
        }
    }
    return null;
}

/**
 * Проверить, авторизован ли пользователь
 */
function isAuthenticated() {
    return getCurrentUser() !== null;
}

/**
 * Выйти из системы
 */
function logout() {
    sessionStorage.removeItem(SESSION_KEY);
}

// === Логика страницы входа ===
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return; // Не на странице входа

    // Если уже авторизован — перенаправляем
    if (isAuthenticated()) {
        window.location.href = 'dashboard.html';
        return;
    }

    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    // Показать/скрыть пароль
    toggleBtn.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        toggleBtn.classList.toggle('active');
    });

    // Обработка формы
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        // Валидация пустых полей
        if (!username || !password) {
            showError('Заполните все поля');
            return;
        }

        // Проверка учётных данных
        const user = validateCredentials(username, password);

        if (user) {
            // Успешный вход
            hideError();
            setSession(user);
            
            // Анимация кнопки
            const btn = document.getElementById('loginBtn');
            btn.classList.add('success');
            btn.querySelector('span').textContent = 'Вход выполнен!';
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);
        } else {
            showError('Неверный логин или пароль');
            // Тряска формы
            loginForm.classList.add('shake');
            setTimeout(() => loginForm.classList.remove('shake'), 500);
        }
    });

    function showError(msg) {
        errorText.textContent = msg;
        errorDiv.classList.remove('hidden');
    }

    function hideError() {
        errorDiv.classList.add('hidden');
    }
});