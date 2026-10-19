/**
 * access-guard.js — Живая проверка прав доступа при каждом переходе
 * ИСПРАВЛЕНО: Синтаксис регулярных выражений (добавлены слэши /.../).
 */
document.addEventListener('DOMContentLoaded', async function() {
    const path = window.location.pathname;

    // 1. Страницы, где проверка не нужна
    const skipPaths = ['/', '/index.html', '/dashboard.html', '/admin-panel.html', '/monitoring.html'];
    if (skipPaths.some(p => path === p || path.endsWith(p))) return;

    let currentSectionId = null;

    // 2. Определяем ID раздела из URL
    // ИСПРАВЛЕНО: Добавлены слэши /.../ для регулярных выражений
    const fileMatch = path.match(/\/pages\/([\w-]+)\.html$/);
    if (fileMatch) {
        const fileName = fileMatch[1] + '.html';
        if (typeof KB_SECTIONS !== 'undefined') {
            const sec = KB_SECTIONS.find(s => s.page.endsWith(fileName));
            if (sec) currentSectionId = sec.id;
        }
    }

    // Если не нашли, пробуем найти по ID операции
    if (!currentSectionId) {
        const opMatch = path.match(/\/operations\/(\d+\.\d+\.\d+)\.html$/);
        if (opMatch && typeof KB_OPERATIONS !== 'undefined') {
            const op = KB_OPERATIONS.find(o => o.id === opMatch[1]);
            if (op) currentSectionId = op.section;
        }
    }

    if (!currentSectionId) return;

    console.log(`🔒 Access Guard: Проверка доступа к разделу "${currentSectionId}" для пути ${path}`);

    // 3. Запрашиваем актуальные права у сервера
    try {
        const response = await fetch('/api/me', { credentials: 'include' });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/index.html';
                return;
            }
            return; 
        }

        const data = await response.json();
        
        if (!data.user) {
            window.location.href = '/index.html';
            return;
        }

        // 4. Проверяем права
        if (data.user.role === 'admin') return;

        const allowedSections = data.sections;
        
        if (Array.isArray(allowedSections) && !allowedSections.includes(currentSectionId)) {
            console.warn(`Access Guard: Доступ к разделу "${currentSectionId}" ЗАКРЫТ. Редирект.`);
            alert('⚠️ Администратор изменил ваши права доступа.\nЭтот раздел больше недоступен.');
            window.location.href = '/dashboard.html';
        } else {
            // 5. Обновляем sessionStorage актуальными данными с сервера
            try {
                const sessionData = JSON.parse(sessionStorage.getItem('modular_house_session') || '{}');
                
                let roleLabel = data.user.role;
                if (roleLabel === 'admin') roleLabel = 'Администратор';
                else if (roleLabel === 'worker') roleLabel = 'Сотрудник производства';
                else if (roleLabel === 'guest') roleLabel = 'Гость';

                sessionData.role = roleLabel;
                sessionData.access = Array.isArray(allowedSections) ? allowedSections : [];
                
                sessionStorage.setItem('modular_house_session', JSON.stringify(sessionData));
                console.log('Access Guard: Сессия обновлена актуальными правами:', sessionData.access);
            } catch (e) {
                console.error('Access Guard: Ошибка обновления сессии:', e);
            }
        }

    } catch (error) {
        console.error('Access Guard: Критическая ошибка проверки прав:', error);
    }
});