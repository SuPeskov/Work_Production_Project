/**
 * accordion.js — Логика аккордеона для раздела Производство
 */

document.addEventListener('DOMContentLoaded', function() {
    // Аккордеон для основных разделов
    const accordionSections = document.querySelectorAll('.accordion-section');
    
    accordionSections.forEach(section => {
        const header = section.querySelector('.accordion-header');
        
        header.addEventListener('click', function() {
            const isOpen = section.classList.contains('active');
            
            // Закрыть все разделы
            accordionSections.forEach(s => {
                s.classList.remove('active');
                const content = s.querySelector('.accordion-content');
                if (content) {
                    content.style.maxHeight = null;
                }
            });
            
            // Открыть текущий, если он был закрыт
            if (!isOpen) {
                section.classList.add('active');
                const content = section.querySelector('.accordion-content');
                if (content) {
                    content.style.maxHeight = content.scrollHeight + "px";
                }
            }
        });
    });
    
    // Аккордеон для подразделов
    const subsectionItems = document.querySelectorAll('.subsection-item');
    
    subsectionItems.forEach(item => {
        const header = item.querySelector('.subsection-header');
        if (!header) return;
        
        header.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = item.classList.contains('active');
            
            // Закрыть все подразделы в этом разделе
            const parentSection = item.closest('.accordion-content');
            parentSection.querySelectorAll('.subsection-item').forEach(sub => {
                sub.classList.remove('active');
                const content = sub.querySelector('.subsection-content');
                if (content) {
                    content.style.maxHeight = null;
                }
            });
            
            // Открыть текущий, если он был закрыт
            if (!isOpen) {
                item.classList.add('active');
                const content = item.querySelector('.subsection-content');
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
        const welcomeNameEl = document.getElementById('welcomeName');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userNameEl) userNameEl.textContent = user.name;
        if (userRoleEl) userRoleEl.textContent = user.role;
        if (welcomeNameEl) welcomeNameEl.textContent = user.name;
        if (userAvatarEl) userAvatarEl.textContent = user.name.charAt(0).toUpperCase();
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (typeof logout === 'function') {
                logout();
            }
            window.location.href = '../index.html';
        });
    }
});

// Авто-раскрытие подраздела при переходе по якорю
window.addEventListener('load', function() {
    const hash = window.location.hash.substring(1);
    if (hash && hash.startsWith('subsection-')) {
        const target = document.getElementById(hash);
        if (target) {
            // Раскрываем родительский раздел
            const parentSection = target.closest('.accordion-section');
            if (parentSection && !parentSection.classList.contains('active')) {
                parentSection.querySelector('.accordion-header').click();
            }
            // Раскрываем сам подраздел
            setTimeout(() => {
                const header = target.querySelector('.subsection-header');
                if (header) header.click();
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }
});