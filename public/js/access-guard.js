/**
 * access-guard.js — Живая проверка прав доступа при каждом переходе
 * ИСПРАВЛЕНО: Синтаксис регулярных выражений и логика определения раздела.
 */
document.addEventListener('DOMContentLoaded', async function() {
    const path = window.location.pathname;

    // 1. Страницы, где проверка не нужна (логин, дашборд, корень, админка, мониторинг)
    const skipPaths = ['/', '/index.html', '/dashboard.html', '/admin-panel.html', '/monitoring.html'];
    if (skipPaths.includes(path)) return;

    let currentSectionId = null;

    // 2. Пытаемся определить раздел по URL
    
    // Вариант А: Страница раздела (например, /pages/panels.html)
    // Регулярное выражение исправлено: добавлены слеши /.../
    const fileMatch = path.match(/\/pages\/([\w-]+)\.html$/);
    if (fileMatch && typeof KB_SECTIONS !== 'undefined') {
        const fileName = fileMatch[1] + '.html'; // panels.html
        const sec = KB_SECTIONS.find(s => s.page.endsWith(fileName));
        if (sec) currentSectionId = sec.id;
    }

    // Вариант Б: Страница операции (например, /pages/operations/2.1.1.html)
    if (!currentSectionId) {
        // Регулярное выражение исправлено
        const opMatch = path.match(/\/operations\/(\d+\.\d+\.\d+)\.html$/);
        if (opMatch && typeof KB_OPERATIONS !== 'undefined') {
            const opId = opMatch[1]; // "2.1.1"
            const op = KB_OPERATIONS.find(o => o.id === opId);
            if (op) currentSectionId = op.section; // "panels"
        }
    }

    // Если не смогли определить раздел (неизвестная страница), пропускаем проверку
    if (!currentSectionId) {
        console.log('Access Guard: Раздел не определен для пути', path);
        return;
    }

    console.log(`Access Guard: Проверка доступа к разделу ${currentSectionId}...`);

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
        if (data.user.role === 'admin') return; // Админу можно всё

        const allowedSections = data.sections; // Массив ID или '*'

        // Если sections это '*', значит доступ ко всему (на всякий случай)
        if (allowedSections === '*') return;

        if (Array.isArray(allowedSections) && !allowedSections.includes(currentSectionId)) {
            // ДОСТУПА НЕТ!
            console.warn(`Доступ к разделу ${currentSectionId} закрыт. Редирект.`);
            
            // Показываем уведомление
            alert('⚠️ Администратор изменил ваши права доступа. Этот раздел больше недоступен.');
            
            // Редирект на дашборд
            window.location.href = '/dashboard.html';
        } else {
            // Доступ есть. Обновляем sessionStorage, чтобы kb.js знал о новых правах
            try {
                const sessionData = JSON.parse(sessionStorage.getItem('modular_house_session') || '{}');
                
                // Нормализуем роль для kb.js (он ждет русские названия)
                let roleLabel = data.user.role;
                if (roleLabel === 'admin') roleLabel = 'Администратор';
                else if (roleLabel === 'worker') roleLabel = 'Сотрудник производства';
                else if (roleLabel === 'guest') roleLabel = 'Гость';

                sessionData.role = roleLabel;
                sessionData.access = Array.isArray(allowedSections) ? allowedSections : [];
                
                sessionStorage.setItem('modular_house_session', JSON.stringify(sessionData));
                console.log('Access Guard: Права актуальны. Сессия обновлена.');
            } catch (e) {
                console.error('Ошибка обновления сессии:', e);
            }
        }

    } catch (error) {
        console.error('Ошибка проверки прав доступа:', error);
    }
});