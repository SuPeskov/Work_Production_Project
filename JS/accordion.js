/**
 * accordion.js — Логика аккордеона для раздела Производство
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('📂 accordion.js загружен');
    
    // === Аккордеон для основных разделов ===
    const accordionSections = document.querySelectorAll('.accordion-section');
    
    accordionSections.forEach(section => {
        const header = section.querySelector('.accordion-header');
        if (!header) return;
        
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
    
    // === Аккордеон для подразделов ===
    const subsectionItems = document.querySelectorAll('.subsection-item');
    
    subsectionItems.forEach(item => {
        const header = item.querySelector('.subsection-header');
        if (!header) return;
        
        header.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = item.classList.contains('active');
            
            // Закрыть все подразделы в этом разделе
            const parentSection = item.closest('.accordion-content');
            if (parentSection) {
                parentSection.querySelectorAll('.subsection-item').forEach(sub => {
                    sub.classList.remove('active');
                    const content = sub.querySelector('.subsection-content');
                    if (content) {
                        content.style.maxHeight = null;
                    }
                });
            }
            
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
    
    // === Инициализация пользователя ===
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

// === Авто-раскрытие по якорю (Разделы и Подразделы) ===
window.addEventListener('load', function() {
    setTimeout(() => {
        const hash = window.location.hash.substring(1);
        if (!hash) return;
        
        console.log('📍 Найден якорь:', hash);
        const target = document.getElementById(hash);
        
        if (!target) return;

        // 1. Если это ОСНОВНОЙ РАЗДЕЛ (section-X)
        if (hash.startsWith('section-')) {
            console.log('📂 Раскрываем основной раздел...');
            if (!target.classList.contains('active')) {
                const header = target.querySelector('.accordion-header');
                if (header) header.click();
            }
            setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                target.classList.add('highlighted');
                setTimeout(() => target.classList.remove('highlighted'), 2500);
            }, 400);
        }
        
        // 2. Если это ПОДРАЗДЕЛ (subsection-X.X)
        else if (hash.startsWith('subsection-')) {
            console.log('📁 Раскрываем подраздел...');
            const parentSection = target.closest('.accordion-section');
            if (parentSection && !parentSection.classList.contains('active')) {
                parentSection.querySelector('.accordion-header').click();
            }
            
            setTimeout(() => {
                const subsectionHeader = target.querySelector('.subsection-header');
                if (subsectionHeader && !target.classList.contains('active')) {
                    subsectionHeader.click();
                }
                setTimeout(() => {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    target.classList.add('highlighted');
                    setTimeout(() => target.classList.remove('highlighted'), 2500);
                }, 400);
            }, 500);
        }
    }, 100);
});