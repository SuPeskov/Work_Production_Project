/**
 * access-guard.js — Живая проверка прав доступа при каждом переходе
 * Решает проблему: админ закрыл доступ, а пользователь всё ещё видит страницу.
 */
document.addEventListener('DOMContentLoaded', async function() {
    // 1. Определяем, на какой странице мы находимся
    const path = window.location.pathname;
    
    // Страницы, где проверка не нужна (логин, дашборд, корень, статика)
    const skipPaths = ['/', '/index.html', '/dashboard.html', '/admin-panel.html', '/monitoring.html'];
    if (skipPaths.includes(path)) return;

    // 2. Пытаемся извлечь ID раздела из URL
    // Примеры: 
    // /pages/panels.html -> panels
    // /pages/operations/2.1.1.html -> panels (через реестр операций)
    // /pages/preparation.html -> preparation
    
    let currentSectionId = null;

    // Сначала пробуем найти по имени файла (для страниц разделов)
    const fileMatch = path.match(/\/pages\/([\w-]+)\.html$/);
    if (fileMatch) {
        // Проверяем, есть ли такой раздел в KB_SECTIONS
        if (typeof KB_SECTIONS !== 'undefined') {
            const sec = KB_SECTIONS.find(s => s.page.endsWith(fileMatch[1] + '.html'));
            if (sec) currentSectionId = sec.id;
        }
    }

    // Если не нашли, пробуем найти по ID операции (для страниц операций)
    if (!currentSectionId) {
        const opMatch = path.match(/\/operations\/(\d+\.\d+\.\d+)\.html$/);
        if (opMatch && typeof KB_OPERATIONS !== 'undefined') {
            const op = KB_OPERATIONS.find(o => o.id === opMatch[1]);
            if (op) currentSectionId = op.section;
        }
    }

    // Если не смогли определить раздел (например, служебная страница), пропускаем проверку
    if (!currentSectionId) return;

    // 3. Запрашиваем актуальные права у сервера
    try {
        const response = await fetch('/api/me', { credentials: 'include' });
        if (!response.ok) {
            // Если 401 — пользователь не авторизован, редирект на логин
            if (response.status === 401) {
                window.location.href = '/index.html';
                return;
            }
            // Игнорируем другие ошибки, чтобы не ломать навигацию при проблемах с сетью
            return; 
        }

        const data = await response.json();
        
        // Если пользователь не найден (сессия истекла на сервере)
        if (!data.user) {
            window.location.href = '/index.html';
            return;
        }

        // 4. Проверяем права
        // Администратор имеет доступ ко всему
        if (data.user.role === 'admin') return;

        // Для остальных проверяем наличие текущего раздела в списке sections
        // data.sections — это массив ID (['preparation', 'panels']) или '*' для админа
        const allowedSections = data.sections;
        
        if (Array.isArray(allowedSections) && !allowedSections.includes(currentSectionId)) {
            // Доступа нет! Принудительный редирект на дашборд
            console.warn(`Доступ к разделу ${currentSectionId} закрыт. Редирект на дашборд.`);
            
            // Показываем уведомление (опционально)
            alert('Администратор изменил ваши права доступа. Этот раздел больше недоступен.');
            
            window.location.href = '/dashboard.html';
        } else {
            // Доступ есть. Обновляем sessionStorage, чтобы kb.js знал о новых правах
            // (на случай, если админ наоборот ОТКРЫЛ доступ, а в сессии его не было)
            try {
                const sessionData = JSON.parse(sessionStorage.getItem('modular_house_session') || '{}');
                // Нормализуем роль для kb.js
                let roleLabel = data.user.role;
                if (roleLabel === 'admin') roleLabel = 'Администратор';
                else if (roleLabel === 'worker') roleLabel = 'Сотрудник производства';
                else if (roleLabel === 'guest') roleLabel = 'Гость';

                sessionData.role = roleLabel;
                sessionData.access = Array.isArray(allowedSections) ? allowedSections : [];
                sessionStorage.setItem('modular_house_session', JSON.stringify(sessionData));
            } catch (e) {
                console.error('Ошибка обновления сессии:', e);
            }
        }

    } catch (error) {
        console.error('Ошибка проверки прав доступа:', error);
        // При ошибке сети не блокируем пользователя, пусть работает с кэшем
    }
});