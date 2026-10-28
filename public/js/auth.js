/**
 * auth.js — ТОЛЬКО обработка формы входа.
 * ИСПРАВЛЕНО: Убран автоматический редирект по sessionStorage.
 * Проверка сессии теперь полностью делегирована kb.js и серверным кукам.
 */
const SESSION_KEY = 'modular_house_session'; // Оставлен только для совместимости, если где-то еще используется

document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    
    // Если формы нет на странице — выходим (это нормально для других страниц)
    if (!loginForm) return;

    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

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
                // Сервер установил куку kb_token. 
                // Мы НЕ пишем ничего в sessionStorage для авторизации.
                // Просто показываем успех и редиректим.
                hideError();
                btn.classList.add('success');
                btn.querySelector('span').textContent = 'Вход выполнен!';
                
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

    function showError(msg) {
        if (errorText) errorText.textContent = msg;
        if (errorDiv) errorDiv.classList.remove('hidden');
    }

    function hideError() {
        if (errorDiv) errorDiv.classList.add('hidden');
    }
});