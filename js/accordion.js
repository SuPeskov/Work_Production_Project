/**
 * accordion.js — Логика аккордеона для страниц разделов
 * Теперь каждый подраздел — это отдельный accordion-section
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log(' accordion.js загружен');
    
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
    
    // Инициализация пользователя
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
        window.location.href = '../index.html';
        return;
    }
    
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (user) {
        const userNameEl = document.getElementById('userName');
        const userRoleEl = document.getElementById('userRole');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userNameEl) userNameEl.textContent = user.name;
        if (userRoleEl) userRoleEl.textContent = user.role;
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
        
        console.log('📍 Якорь:', hash);
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