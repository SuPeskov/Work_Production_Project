/**
 * auth.js — Логика авторизации и управления сессией
 * Включает защиту от параллельных входов (перехват 401 -> session-terminated)
 * и обработку ошибки 409 (пользователь уже активен).
 */
const SESSION_KEY = 'modular_house_session';

function setSession(user) {
    const session = {
        username: user.username,
        name: user.name,
        role: user.roleLabel || user.role,
        access: user.access || [],
        loginTime: new Date().toISOString()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getCurrentUser() {
    const data = sessionStorage.getItem(SESSION_KEY);
    if (data) {
        try { return JSON.parse(data); } catch (e) { return null; }
    }
    return null;
}

function isAuthenticated() {
    return getCurrentUser() !== null;
}

function logout() {
    // Сначала отправляем запрос на сервер и ЖДЕМ ответа
    fetch('/api/logout', { 
        method: 'POST', 
        credentials: 'include' 
    })
    .then(response => {
        if (response.ok) {
            // Только после успешного ответа сервера очищаем локальную сессию
            sessionStorage.removeItem(SESSION_KEY);
            // И переходим на страницу входа
            window.location.href = '/index.html';
        } else {
            console.error('Ошибка выхода:', response.status);
            // Даже при ошибке сервера — выходим локально, чтобы пользователь не застрял
            sessionStorage.removeItem(SESSION_KEY);
            window.location.href = '/index.html';
        }
    })
    .catch(error => {
        console.error('Сетевая ошибка при выходе:', error);
        // При сетевой ошибке тоже выходим локально
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = '/index.html';
    });
}

// === Перехватчик завершения сессии из-за нового входа ===
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        
        // Если получили 401 и мы НЕ на странице входа/предупреждения
        if (response.status === 401 && 
            !window.location.pathname.includes('index.html') && 
            !window.location.pathname.includes('session-terminated')) {
            
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
    
    if (isAuthenticated()) {
        window.location.href = 'dashboard.html';
        return;
    }
    
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            toggleBtn.classList.toggle('active');
        });
    }
    
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
                hideError();
                // Запрашиваем полные данные пользователя (с разделами)
                const meResponse = await fetch('/api/me', { credentials: 'include' });
                const meData = await meResponse.json();
                
                if (meData.user) {
                    setSession({
                        ...meData.user,
                        access: meData.sections
                    });
                } else {
                    setSession(data.user);
                }
                
                btn.classList.add('success');
                btn.querySelector('span').textContent = 'Вход выполнен!';
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 800);
            } else {
                // ОБРАБОТКА ОШИБОК
                let errorMsg = data.error || 'Неверный логин или пароль';
                
                // Специальная обработка для занятой сессии (код 409)
                if (response.status === 409) {
                    errorMsg = '⚠️ Этот сотрудник уже работает в системе!\nПовторный вход под одним логином запрещен.';
                }
                
                showError(errorMsg);
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
    
    function showError(msg) {
        if (errorText) errorText.textContent = msg;
        if (errorDiv) errorDiv.classList.remove('hidden');
    }
    
    function hideError() {
        if (errorDiv) errorDiv.classList.add('hidden');
    }
});