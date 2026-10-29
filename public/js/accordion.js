/**
 * accordion.js — Логика аккордеона для страниц разделов
 * ИСПРАВЛЕНО: Убрана проверка авторизации (теперь этим занимается kb.js)
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('accordion.js загружен');
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

    // Кнопка выхода (можно оставить, если она есть в HTML, но лучше делегировать kb.js)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof logout === 'function') logout();
            else window.location.href = '../index.html';
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