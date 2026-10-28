/**
 * auth.js — Минимальная логика авторизации и защита сессии
 * ИСПРАВЛЕНО: 
 * 1. Убрана дублирующая проверка прав (делегировано kb.js)
 * 2. Сохранен перехват 401 для принудительного выхода при новом входе
 * 3. Форма входа просто устанавливает куку и редиректит
 */

const SESSION_KEY = 'modular_house_session'; // Оставлен только для совместимости со старым UI

// === ПЕРЕХВАТЧИК ЗАВЕРШЕНИЯ СЕССИИ (Защита от параллельных входов) ===
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        
        // Если получили 401 и мы НЕ на странице входа/предупреждения
        if (response.status === 401 && 
            !window.location.pathname.includes('index.html') && 
            !window.location.pathname.includes('session-terminated')) {
            
            // Очищаем локальную сессию ПЕРЕД редиректом
            sessionStorage.removeItem(SESSION_KEY);
            
            try {
                const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
                const username = session.username || 'пользователя';
                window.location.href = `/session-terminated.html?user=${encodeURIComponent(username)}`;
            } catch (e) {
                window.location.href = '/session-terminated.html';
            }
        }
        return response;
    };
})();

document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    // Проверка валидности сессии при загрузке страницы входа
    if (sessionStorage.getItem(SESSION_KEY)) {
        fetch('/api/me', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.user) {
                window.location.href = 'dashboard.html';
            } else {
                sessionStorage.removeItem(SESSION_KEY);
            }
        })
        .catch(() => sessionStorage.removeItem(SESSION_KEY));
        return;
    }

    // Обработка формы входа
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            showError('Заполните все поля');
            return;
        }

        const btn = document.getElementById('loginBtn');
        const originalText = btn.querySelector('span').textContent;
        btn.disabled = true;
        btn.querySelector('span').textContent = 'Проверка...';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.ok) {
                // Сохраняем базовые данные для быстрого отображения до загрузки полного профиля
                setSession(data.user);
                btn.classList.add('success');
                btn.querySelector('span').textContent = 'Вход выполнен!';
                
                // Небольшая задержка для визуального подтверждения
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 500);
            } else {
                showError(data.error || 'Неверный логин или пароль');
                loginForm.classList.add('shake');
                setTimeout(() => loginForm.classList.remove('shake'), 500);
            }
        } catch (error) {
            console.error('Ошибка входа:', error);
            showError('Ошибка соединения с сервером');
        } finally {
            btn.disabled = false;
            btn.querySelector('span').textContent = originalText;
        }
    });

    // Переключатель видимости пароля
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            toggleBtn.classList.toggle('active');
        });
    }

    function setSession(user) {
        const session = {
            username: user.username,
            name: user.name,
            role: user.roleLabel || user.role,
            loginTime: new Date().toISOString()
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    function showError(msg) {
        if (errorText) errorText.textContent = msg;
        if (errorDiv) errorDiv.classList.remove('hidden');
    }
});