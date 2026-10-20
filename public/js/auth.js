/**
 * auth.js — Логика авторизации и управления сессией
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
    fetch('/api/logout', { method: 'POST', credentials: 'include' })
        .finally(() => { 
            sessionStorage.removeItem(SESSION_KEY);
            window.location.href = '/index.html'; 
        });
}

// === АВТОМАТИЧЕСКИЙ ВЫХОД ПРИ ЗАКРЫТИИ ВКЛАДКИ ===
window.addEventListener('beforeunload', function(e) {
    if (isAuthenticated()) {
        // sendBeacon гарантирует отправку запроса даже при закрытии страницы
        navigator.sendBeacon('/api/logout', new Blob([], { type: 'application/json' }));
        sessionStorage.removeItem(SESSION_KEY);
    }
});

// === Перехватчик 401 (принудительный выход админом или истечение токена) ===
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        if (response.status === 401 && 
            !window.location.pathname.includes('index.html') && 
            !window.location.pathname.includes('session-terminated')) {
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
                const meResponse = await fetch('/api/me', { credentials: 'include' });
                const meData = await meResponse.json();
                if (meData.user) {
                    setSession({ ...meData.user, access: meData.sections });
                } else {
                    setSession(data.user);
                }
                btn.classList.add('success');
                btn.querySelector('span').textContent = 'Вход выполнен!';
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
            } else {
                let errorMsg = data.error || 'Неверный логин или пароль';
                if (response.status === 409) {
                    errorMsg = '⚠️ Этот пользователь уже работает в системе!\nПовторный вход под одним логином запрещен.';
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