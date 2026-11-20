/**
 * accordion.js — Логика аккордеона + фильтрация черновиков
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('📂 accordion.js загружен');
    
    // === ФИЛЬТРАЦИЯ ЧЕРНОВИКОВ В АККОРДЕОНЕ ===
    // Проверяем, есть ли у нас доступ к данным операций из kb.js
    if (typeof KB_OPERATIONS !== 'undefined' && typeof isAuthenticated === 'function') {
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const isAdmin = user && (user.role === 'Администратор' || user.role === 'admin');
        
        // Находим все ссылки на операции внутри аккордеона
        document.querySelectorAll('.operations-list a').forEach(link => {
            const href = link.getAttribute('href');
            // Извлекаем ID операции из URL (например, 3.1.1.html)
            const match = href.match(/(\d+\.\d+\.\d+)\.html/);
            if (!match) return;
            
            const opId = match[1];
            const op = KB_OPERATIONS.find(o => o.id === opId);
            
            // Если операция найдена и имеет статус draft
            if (op && op.status === 'draft') {
                if (isAdmin) {
                    // Админу показываем, но добавляем метку "Черновик"
                    if (!link.querySelector('.draft-badge')) {
                        const badge = document.createElement('span');
                        badge.className = 'draft-badge';
                        badge.textContent = ' ✎ Черновик';
                        badge.style.cssText = 'font-size:11px;color:#b45309;background:#fef3c7;padding:2px 6px;border-radius:6px;margin-left:8px;white-space:nowrap;font-weight:600;';
                        link.appendChild(badge);
                        
                        // Делаем саму ссылку полупрозрачной, чтобы визуально отличить
                        link.style.opacity = '0.7';
                    }
                } else {
                    // Остальным пользователям скрываем элемент списка полностью
                    const li = link.closest('li');
                    if (li) li.style.display = 'none';
                }
            }
        });
    }
    // ==========================================

    // === ЛОГИКА АККОРДЕОНА (без изменений) ===
    const accordionSections = document.querySelectorAll('.accordion-section');
    accordionSections.forEach(section => {
        const header = section.querySelector('.accordion-header');
        if (!header) return;
        
        header.addEventListener('click', function() {
            const isOpen = section.classList.contains('active');
            
            // Закрыть все подразделы
            accordionSections.forEach(s => {
                s.classList.remove('active');
                const content = s.querySelector('.accordion-content');
                if (content) content.style.maxHeight = null;
            });
            
            // Открыть текущий, если был закрыт
            if (!isOpen) {
                section.classList.add('active');
                const content = section.querySelector('.accordion-content');
                if (content) {
                    content.style.maxHeight = content.scrollHeight + "px";
                }
            }
        });
    });

    // Инициализация пользователя в шапке
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
        window.location.href = '../index.html';
        return;
    }
    
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (user) {
        const userNameEl = document.getElementById('currentUserName') || document.getElementById('userName');
        const userRoleEl = document.getElementById('currentUserRole') || document.getElementById('userRole');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userNameEl && userNameEl.tagName === 'SPAN') userNameEl.textContent = user.name;
        if (userRoleEl && userRoleEl.tagName === 'SPAN') userRoleEl.textContent = user.role;
        if (userAvatarEl) userAvatarEl.textContent = user.name.charAt(0).toUpperCase();
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (typeof logout === 'function') logout();
            window.location.href = '../index.html';
        });
    }
});

// === Авто-раскрытие по якорю ===
window.addEventListener('load', function() {
    setTimeout(() => {
        const hash = window.location.hash.substring(1);
        if (!hash || !hash.startsWith('section-')) return;
        
        const target = document.getElementById(hash);
        if (!target) return;
        
        if (!target.classList.contains('active')) {
            const header = target.querySelector('.accordion-header');
            if (header) header.click();
        }
        
        setTimeout(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('highlighted');
            setTimeout(() => target.classList.remove('highlighted'), 2500);
        }, 400);
    }, 100);
});